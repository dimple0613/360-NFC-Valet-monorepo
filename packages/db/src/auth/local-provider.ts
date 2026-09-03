import { prismaWithoutTenantScoping } from "../client";
import type { AuthProvider, AuthResult } from "./provider";
import { assertPasswordStrength, hashPassword, verifyPassword } from "./password";
import { consumeVerificationToken, createVerificationToken } from "./verification-tokens";
import { consoleEmailSender, type EmailSender } from "./email-sender";
import { revokeAllUserSessions } from "./session";
import { verifyAndConsumeRecoveryCode, verifyMfaCode } from "./mfa";
import { maybeGrantBootstrapSuperAdmin } from "./platform-bootstrap";

// FR-220: Local (email+password) provider — signup, login, password reset,
// email verification.

const EMAIL_VERIFICATION_PURPOSE = "email_verification";
const PASSWORD_RESET_PURPOSE = "password_reset";
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// A pre-computed, valid-format Argon2id hash with no corresponding real
// password. login() verifies against this when the email isn't registered,
// so the response takes the same amount of time either way — otherwise a
// missing-user short-circuit would let an attacker enumerate registered
// emails by timing.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$StzYgt9/GPe6m3uQOhISNg$ntpeCckF0+nq2J0W07dtfS+8T0zxo6m2ymiyEl45LdM";

export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`An account with email ${email} already exists.`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountNotActiveError extends Error {
  constructor() {
    super("This account is not active.");
    this.name = "AccountNotActiveError";
  }
}

export class InvalidMfaChallengeError extends Error {
  constructor() {
    super("Invalid MFA code or recovery code.");
    this.name = "InvalidMfaChallengeError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

export interface SignUpInput {
  email: string;
  password: string;
  name?: string;
}

/** Creates a Local-provider account. Does not create an organization or membership — see the module doc comment in organization-lifecycle.ts; composing signup with org creation is a route/workflow concern, not this adapter's. */
export async function signUp(
  input: SignUpInput,
  emailSender: EmailSender = consoleEmailSender,
): Promise<{ userId: string }> {
  await assertPasswordStrength(input.password);
  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new EmailAlreadyRegisteredError(input.email);
    throw error;
  }

  const token = await createVerificationToken({
    userId: user.id,
    purpose: EMAIL_VERIFICATION_PURPOSE,
    expiresInMs: EMAIL_VERIFICATION_TTL_MS,
  });
  await emailSender.send({
    to: user.email,
    subject: "Verify your email",
    body: `Your verification token: ${token}`,
  });

  await maybeGrantBootstrapSuperAdmin(user.id, user.email);

  return { userId: user.id };
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const { userId } = await consumeVerificationToken({ rawToken, purpose: EMAIL_VERIFICATION_PURPOSE });
  await prismaWithoutTenantScoping.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

export type LoginResult = { status: "ok"; userId: string } | { status: "mfa_required"; userId: string };

/** Credential check only — the AuthProvider contract's "authenticate" step. Session creation is a separate concern (session.ts), orchestrated by whatever calls login() (route/action, not yet built). */
export async function login(input: { email: string; password: string }): Promise<LoginResult> {
  const user = await prismaWithoutTenantScoping.user.findUnique({ where: { email: input.email } });
  const passwordMatches = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, input.password);

  if (!user || !user.passwordHash || !passwordMatches) throw new InvalidCredentialsError();
  if (user.status !== "ACTIVE") throw new AccountNotActiveError();

  return user.mfaEnabled ? { status: "mfa_required", userId: user.id } : { status: "ok", userId: user.id };
}

/** Completes a login that returned mfa_required — accepts either a live TOTP code or an unused recovery code. */
export async function completeMfaLogin(userId: string, code: string): Promise<AuthResult> {
  const validTotp = await verifyMfaCode(userId, code);
  const validRecovery = validTotp ? false : await verifyAndConsumeRecoveryCode(userId, code);
  if (!validTotp && !validRecovery) throw new InvalidMfaChallengeError();
  return { userId };
}

export async function requestPasswordReset(
  email: string,
  emailSender: EmailSender = consoleEmailSender,
): Promise<void> {
  const user = await prismaWithoutTenantScoping.user.findUnique({ where: { email } });
  if (!user) return; // don't reveal whether the email is registered

  const token = await createVerificationToken({
    userId: user.id,
    purpose: PASSWORD_RESET_PURPOSE,
    expiresInMs: PASSWORD_RESET_TTL_MS,
  });
  await emailSender.send({ to: user.email, subject: "Reset your password", body: `Your reset token: ${token}` });
}

/** Resets the password and revokes every existing session — a password change should invalidate sessions established under the old credential. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const { userId } = await consumeVerificationToken({ rawToken, purpose: PASSWORD_RESET_PURPOSE });
  await assertPasswordStrength(newPassword);
  const passwordHash = await hashPassword(newPassword);
  await prismaWithoutTenantScoping.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllUserSessions(userId);
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Self-service password change for an already-logged-in user (distinct from
 * resetPassword's unauthenticated, token-based flow). Revokes every other
 * session on the credential change, same as resetPassword, but keeps
 * `currentSessionId` alive (if given) so changing your password doesn't log
 * you out of the device you're using right now.
 */
export async function changePassword(input: ChangePasswordInput, currentSessionId?: string): Promise<void> {
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: input.userId } });
  const passwordMatches = await verifyPassword(user.passwordHash ?? DUMMY_HASH, input.currentPassword);
  if (!user.passwordHash || !passwordMatches) throw new InvalidCredentialsError();

  await assertPasswordStrength(input.newPassword);
  const passwordHash = await hashPassword(input.newPassword);
  await prismaWithoutTenantScoping.user.update({ where: { id: input.userId }, data: { passwordHash } });
  await revokeAllUserSessions(input.userId, currentSessionId);
}

export const localAuthProvider: AuthProvider<{ email: string; password: string }> = {
  id: "local",
  async authenticate(credentials) {
    const result = await login(credentials);
    if (result.status === "mfa_required") {
      throw new Error("MFA required — call completeMfaLogin after login() before treating this as authenticated.");
    }
    return { userId: result.userId };
  },
};
