import * as OTPAuth from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { login } from "../auth/local-provider";
import { beginMfaEnrollment, confirmMfaEnrollment } from "../auth/mfa";
import { hashPassword } from "../auth/password";
import { resolveOAuthSignIn } from "../auth/oauth-provider";
import { setSecurityDefaultSettings } from "../platform-config";

const VALID_PASSWORD = "correct-horse-battery-staple";
const runId = Date.now().toString(36);

async function clearSecuritySettings() {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({
    where: { key: { in: ["security.require_2fa", "security.captcha_provider", "security.captcha_site_key", "security.captcha_secret_key"] } },
  });
}

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

// Platform-wide "Require 2FA" (security.require_2fa) must block users without
// a second factor at sign-in — local login and OAuth alike — and route them to
// MFA *enrollment* instead of a session.
describe("require-2FA enforcement", () => {
  const users: Array<{ id: string; email: string }> = [];
  const oauthAccounts: Array<{ userId: string; provider: string; providerUserId: string }> = [];

async function makeUser(email: string): Promise<{ id: string; email: string }> {
  const user = await prismaWithoutTenantScoping.user.create({
    data: { email, passwordHash: await hashPassword(VALID_PASSWORD), emailVerifiedAt: new Date() },
  });
  users.push(user);
  return user;
}

  beforeAll(async () => {
    await setSecurityDefaultSettings({ require2fa: true, captchaProvider: "none" });
  });

  afterAll(async () => {
    await clearSecuritySettings();
    await prismaWithoutTenantScoping.oAuthAccount.deleteMany({
      where: { userId: { in: users.map((u) => u.id) } },
    }).catch(() => {});
    await prismaWithoutTenantScoping.mfaRecoveryCode.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  it("local login with no second factor demands enrollment, not a session", async () => {
    const user = await makeUser(`req2fa-nomfa-${runId}@example.com`);
    await expect(
      login({ email: user.email, password: "correct-horse-battery-staple" }),
    ).resolves.toEqual({ status: "mfa_enrollment_required", userId: user.id });
  });

  it("local login with an enrolled second factor goes to the normal challenge", async () => {
    const user = await makeUser(`req2fa-enrolled-${runId}@example.com`);
    const { secret } = await beginMfaEnrollment(user.id);
    await confirmMfaEnrollment(user.id, codeFor(secret));
    await expect(
      login({ email: user.email, password: "correct-horse-battery-staple" }),
    ).resolves.toEqual({ status: "mfa_required", userId: user.id });
  });

  it("OAuth resolution flags enrollment for an unenrolled user when require-2FA is on", async () => {
    const user = await makeUser(`req2fa-oauth-${runId}@example.com`);
    const providerUserId = `google-${runId}`;
    oauthAccounts.push({ userId: user.id, provider: "google", providerUserId });
    await prismaWithoutTenantScoping.oAuthAccount.create({
      data: { userId: user.id, provider: "google", providerUserId },
    });

    const result = await resolveOAuthSignIn({
      provider: "google",
      providerUserId,
      email: user.email,
      name: "Req 2FA",
      emailVerified: true,
    });
    // Pre-existing account, but require-2FA is on and it has no factor → forced
    // to enroll, not straight into a session — and no challenge either (there
    // is nothing to challenge against yet).
    expect(result.mfaEnrollmentRequired).toBe(true);
    expect(result.mfaRequired).toBe(false);
  });

  it("with require-2FA off, an unenrolled user keeps logging straight in", async () => {
    await setSecurityDefaultSettings({ require2fa: false, captchaProvider: "none" });
    const user = await makeUser(`req2fa-off-${runId}@example.com`);
    await expect(
      login({ email: user.email, password: "correct-horse-battery-staple" }),
    ).resolves.toEqual({ status: "ok", userId: user.id });
  });
});