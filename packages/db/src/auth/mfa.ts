import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { prismaWithoutTenantScoping } from "../client";
import { decrypt, encrypt } from "../encryption";
import { hashPassword, verifyPassword } from "./password";

// FR-222: MFA via TOTP + recovery codes. Enrollment is two-step: begin
// generates+stores an encrypted secret (mfaEnabled stays false), confirm
// requires a valid code from that secret before flipping mfaEnabled true and
// issuing recovery codes — so a secret sitting unconfirmed (user closed the
// tab mid-setup) never grants a false sense of MFA being active.

const ISSUER = "saasclaude";
const RECOVERY_CODE_COUNT = 10;

function buildTotp(email: string, secret: OTPAuth.Secret): OTPAuth.TOTP {
  return new OTPAuth.TOTP({ issuer: ISSUER, label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
}

export class InvalidMfaCodeError extends Error {
  constructor() {
    super("Invalid MFA code.");
    this.name = "InvalidMfaCodeError";
  }
}

export class MfaNotPendingError extends Error {
  constructor() {
    super("No MFA enrollment is in progress for this user — call beginMfaEnrollment first.");
    this.name = "MfaNotPendingError";
  }
}

export async function beginMfaEnrollment(userId: string): Promise<{ secret: string; provisioningUri: string }> {
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: userId } });
  const totp = buildTotp(user.email, new OTPAuth.Secret());
  await prismaWithoutTenantScoping.user.update({
    where: { id: userId },
    data: { mfaSecretEncrypted: encrypt(totp.secret.base32) },
  });
  return { secret: totp.secret.base32, provisioningUri: totp.toString() };
}

export async function confirmMfaEnrollment(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecretEncrypted) throw new MfaNotPendingError();

  const totp = buildTotp(user.email, OTPAuth.Secret.fromBase32(decrypt(user.mfaSecretEncrypted)));
  if (totp.validate({ token: code, window: 1 }) === null) throw new InvalidMfaCodeError();

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(5).toString("hex"));
  const hashedCodes = await Promise.all(recoveryCodes.map((raw) => hashPassword(raw)));

  await prismaWithoutTenantScoping.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } }); // clear any stale codes from an earlier aborted enrollment
    await tx.mfaRecoveryCode.createMany({ data: hashedCodes.map((codeHash) => ({ userId, codeHash })) });
    await tx.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  });

  return { recoveryCodes };
}

export async function disableMfa(userId: string): Promise<void> {
  await prismaWithoutTenantScoping.$transaction([
    prismaWithoutTenantScoping.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEncrypted: null },
    }),
    prismaWithoutTenantScoping.mfaRecoveryCode.deleteMany({ where: { userId } }),
  ]);
}

/** Verifies a TOTP code against an already-enrolled (mfaEnabled) user's secret. Does not consume anything — a TOTP code is naturally single-use per time step. */
export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaEnabled || !user.mfaSecretEncrypted) return false;
  const totp = buildTotp(user.email, OTPAuth.Secret.fromBase32(decrypt(user.mfaSecretEncrypted)));
  return totp.validate({ token: code, window: 1 }) !== null;
}

/** Verifies a recovery code and consumes it (single-use) if valid. */
export async function verifyAndConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const candidates = await prismaWithoutTenantScoping.mfaRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });
  for (const candidate of candidates) {
    if (await verifyPassword(candidate.codeHash, code)) {
      await prismaWithoutTenantScoping.mfaRecoveryCode.update({
        where: { id: candidate.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}
