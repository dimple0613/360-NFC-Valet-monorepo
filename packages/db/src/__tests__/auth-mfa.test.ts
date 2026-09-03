import * as OTPAuth from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { decrypt } from "../encryption";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  InvalidMfaCodeError,
  MfaNotPendingError,
  verifyAndConsumeRecoveryCode,
  verifyMfaCode,
} from "../auth/mfa";

const runId = Date.now().toString(36);

function codeFor(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "saasclaude",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

describe("MFA (TOTP + recovery codes)", () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `mfa-${runId}@example.com` },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
  });

  it("confirmMfaEnrollment rejects when no enrollment is pending", async () => {
    await expect(confirmMfaEnrollment(user.id, "123456")).rejects.toThrow(MfaNotPendingError);
  });

  it("begin -> confirm with a valid code enables MFA and issues recovery codes", async () => {
    const { secret } = await beginMfaEnrollment(user.id);

    const midEnrollment = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(midEnrollment.mfaEnabled).toBe(false); // not enabled until confirmed

    const { recoveryCodes } = await confirmMfaEnrollment(user.id, codeFor(secret));
    expect(recoveryCodes).toHaveLength(10);

    const enrolled = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(enrolled.mfaEnabled).toBe(true);
    expect(enrolled.mfaSecretEncrypted).not.toBeNull();
    // Sanity: the stored value really is ciphertext, not the raw secret.
    expect(enrolled.mfaSecretEncrypted).not.toBe(secret);
    expect(decrypt(enrolled.mfaSecretEncrypted!)).toBe(secret);
  });

  it("confirmMfaEnrollment rejects an invalid code", async () => {
    await beginMfaEnrollment(user.id); // re-begin (overwrites the pending secret)
    await expect(confirmMfaEnrollment(user.id, "000000")).rejects.toThrow(InvalidMfaCodeError);
  });

  it("verifyMfaCode accepts a valid current code and rejects a bogus one", async () => {
    const { secret } = await beginMfaEnrollment(user.id);
    await confirmMfaEnrollment(user.id, codeFor(secret));

    await expect(verifyMfaCode(user.id, codeFor(secret))).resolves.toBe(true);
    await expect(verifyMfaCode(user.id, "000000")).resolves.toBe(false);
  });

  it("recovery codes verify once each and are then consumed", async () => {
    const { secret } = await beginMfaEnrollment(user.id);
    const { recoveryCodes } = await confirmMfaEnrollment(user.id, codeFor(secret));

    const [firstCode] = recoveryCodes;
    await expect(verifyAndConsumeRecoveryCode(user.id, firstCode!)).resolves.toBe(true);
    // Same code again: already used.
    await expect(verifyAndConsumeRecoveryCode(user.id, firstCode!)).resolves.toBe(false);
  });

  it("disableMfa turns it off and clears recovery codes", async () => {
    const { secret } = await beginMfaEnrollment(user.id);
    await confirmMfaEnrollment(user.id, codeFor(secret));

    await disableMfa(user.id);

    const disabled = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(disabled.mfaEnabled).toBe(false);
    expect(disabled.mfaSecretEncrypted).toBeNull();

    const remainingCodes = await prismaWithoutTenantScoping.mfaRecoveryCode.findMany({ where: { userId: user.id } });
    expect(remainingCodes).toHaveLength(0);
  });
});
