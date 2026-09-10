import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { beginMfaEnrollment, confirmMfaEnrollment } from "../auth/mfa";
import type { EmailSender } from "../auth/email-sender";
import {
  AccountNotActiveError,
  changePassword,
  completeMfaLogin,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidMfaChallengeError,
  login,
  requestPasswordReset,
  resetPassword,
  signUp,
  verifyEmail,
} from "../auth/local-provider";
import { createSession, resolveSession } from "../auth/session";

const runId = Date.now().toString(36);
let counter = 0;
function nextEmail() {
  counter += 1;
  return `local-provider-${runId}-${counter}@example.com`;
}

function capturingEmailSender(): { sender: EmailSender; sent: { to: string; subject: string; body: string }[] } {
  const sent: { to: string; subject: string; body: string }[] = [];
  return {
    sender: {
      async send(params) {
        sent.push(params);
      },
    },
    sent,
  };
}

function extractToken(body: string): string {
  const match = body.match(/token: (\S+)/);
  if (!match) throw new Error(`No token found in email body: ${body}`);
  return match[1]!;
}

describe("local auth provider", () => {
  const createdEmails: string[] = [];

  afterAll(async () => {
    await prismaWithoutTenantScoping.user.deleteMany({ where: { email: { in: createdEmails } } });
  });

  it("signUp creates an unverified user and sends a verification email", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { sender, sent } = capturingEmailSender();

    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" }, sender);

    const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).not.toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
  });

  it("signUp rejects a duplicate email", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    await signUp({ email, password: "correct-horse-battery-staple" });
    await expect(signUp({ email, password: "another-long-password" })).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
  });

  it("verifyEmail marks the account verified using the emailed token", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { sender, sent } = capturingEmailSender();
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" }, sender);

    await verifyEmail(extractToken(sent[0]!.body));

    const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("login succeeds with correct credentials and fails with wrong password or unknown email", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });

    await expect(login({ email, password: "correct-horse-battery-staple" })).resolves.toEqual({
      status: "ok",
      userId,
    });
    await expect(login({ email, password: "wrong-password" })).rejects.toThrow(InvalidCredentialsError);
    await expect(login({ email: "nobody-here@example.com", password: "whatever12345" })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it("login rejects a non-ACTIVE account", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });
    await prismaWithoutTenantScoping.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });

    await expect(login({ email, password: "correct-horse-battery-staple" })).rejects.toThrow(
      AccountNotActiveError,
    );
  });

  it("login returns mfa_required for an MFA-enabled account, completeMfaLogin finishes it", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });
    const { secret } = await beginMfaEnrollment(userId);
    const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
    await confirmMfaEnrollment(userId, totp.generate());

    await expect(login({ email, password: "correct-horse-battery-staple" })).resolves.toEqual({
      status: "mfa_required",
      userId,
    });

    await expect(completeMfaLogin(userId, "000000")).rejects.toThrow(InvalidMfaChallengeError);
    await expect(completeMfaLogin(userId, totp.generate())).resolves.toEqual({ userId });
  });

  it("password reset: request + reset changes the password and revokes existing sessions", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });

    const { rawToken: sessionToken } = await createSession({ userId });
    await expect(resolveSession(sessionToken)).resolves.toBeDefined();

    const { sender, sent } = capturingEmailSender();
    await requestPasswordReset(email, sender);
    expect(sent).toHaveLength(1);

    await resetPassword(extractToken(sent[0]!.body), "brand-new-long-password");

    await expect(login({ email, password: "correct-horse-battery-staple" })).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(login({ email, password: "brand-new-long-password" })).resolves.toEqual({
      status: "ok",
      userId,
    });
    // The session created before the reset should no longer resolve.
    await expect(resolveSession(sessionToken)).rejects.toThrow();
  });

  it("changePassword rejects a wrong current password", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });

    await expect(
      changePassword({ userId, currentPassword: "not-the-password", newPassword: "brand-new-long-password" }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("changePassword updates the password and revokes other sessions but keeps the current one", async () => {
    const email = nextEmail();
    createdEmails.push(email);
    const { userId } = await signUp({ email, password: "correct-horse-battery-staple" });

    const { rawToken: currentToken, session: currentSession } = await createSession({ userId });
    const { rawToken: otherToken } = await createSession({ userId });

    await changePassword(
      { userId, currentPassword: "correct-horse-battery-staple", newPassword: "brand-new-long-password" },
      currentSession.id,
    );

    await expect(login({ email, password: "correct-horse-battery-staple" })).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(login({ email, password: "brand-new-long-password" })).resolves.toEqual({
      status: "ok",
      userId,
    });
    await expect(resolveSession(currentToken)).resolves.toBeDefined();
    await expect(resolveSession(otherToken)).rejects.toThrow();
  });

  it("requestPasswordReset silently no-ops for an unregistered email (no leak)", async () => {
    const { sender, sent } = capturingEmailSender();
    await expect(requestPasswordReset("never-signed-up@example.com", sender)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
