import { afterAll, describe, expect, it, vi } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { setSecurityDefaultSettings, verifyCaptcha } from "../platform-config";

// Google's documented public verification-only reCAPTCHA keys. They exist so
// you can exercise the widget + siteverify round-trip without a real project.
// None of this is a credential — Google publishes them for exactly this purpose.
const TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const TEST_SECRET = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

const SECURITY_KEYS = [
  "security.require_2fa",
  "security.captcha_provider",
  "security.captcha_site_key",
  "security.captcha_secret_key",
];

async function clearSecuritySettings() {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key: { in: SECURITY_KEYS } } });
}

// verifyCaptcha: fail-open when nothing is configured, enforce (against the
// provider's public siteverify endpoint) once a provider + keys are set.
describe("verifyCaptcha", () => {
  const fetchMock = vi.fn<typeof fetch>();

  afterAll(async () => {
    vi.unstubAllGlobals();
    await clearSecuritySettings();
  });

  function stubVerifier(result: unknown, ok = true) {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status: ok ? 200 : 500 }));
    vi.stubGlobal("fetch", fetchMock);
  }

  it("passes every token when no provider is configured", async () => {
    await setSecurityDefaultSettings({ require2fa: false, captchaProvider: "none", captchaSiteKey: null });
    vi.stubGlobal("fetch", fetchMock.mockReset().mockResolvedValue(new Response("unreachable", { status: 500 })));
    await expect(verifyCaptcha("anything")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing token when a provider is configured", async () => {
    stubVerifier({ success: false });
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v2",
      captchaSiteKey: TEST_SITE_KEY,
      captchaSecretKey: TEST_SECRET,
    });
    await expect(verifyCaptcha("")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a successful reCAPTCHA v2 verification and posts secret+response", async () => {
    stubVerifier({ success: true });
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v2",
      captchaSiteKey: TEST_SITE_KEY,
      captchaSecretKey: TEST_SECRET,
    });
    await expect(verifyCaptcha("token-abc")).resolves.toBe(true);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(String(url)).toBe("https://www.google.com/recaptcha/api/siteverify");
    const body = String(init?.body ?? "");
    expect(body).toContain("secret=" + TEST_SECRET);
    expect(body).toContain("response=token-abc");
  });

  it("rejects a rejected reCAPTCHA v2 verification", async () => {
    stubVerifier({ success: false, "error-codes": ["invalid-input-response"] });
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v2",
      captchaSiteKey: TEST_SITE_KEY,
      captchaSecretKey: TEST_SECRET,
    });
    await expect(verifyCaptcha("token-abc")).resolves.toBe(false);
  });

  it("enforces the reCAPTCHA v3 score floor", async () => {
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v3",
      captchaSiteKey: TEST_SITE_KEY,
      captchaSecretKey: TEST_SECRET,
    });
    stubVerifier({ success: true, score: 0.9 });
    await expect(verifyCaptcha("token-abc")).resolves.toBe(true);

    stubVerifier({ success: true, score: 0.3 });
    await expect(verifyCaptcha("token-abc")).resolves.toBe(false);
  });

  it("verifies hCaptcha against its own endpoint", async () => {
    stubVerifier({ success: true });
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "hcaptcha",
      captchaSiteKey: "hc-site",
      captchaSecretKey: "hc-secret",
    });
    await expect(verifyCaptcha("hc-token")).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://hcaptcha.com/siteverify");
  });

  it("fails closed on an upstream verification error", async () => {
    stubVerifier({ success: true }, false);
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v2",
      captchaSiteKey: TEST_SITE_KEY,
      captchaSecretKey: TEST_SECRET,
    });
    await expect(verifyCaptcha("token-abc")).resolves.toBe(false);
  });

  it("fails open when provider is set but keys are missing (nothing to verify)", async () => {
    await setSecurityDefaultSettings({
      require2fa: false,
      captchaProvider: "recaptcha_v2",
      captchaSiteKey: null,
      captchaSecretKey: null,
    });
    vi.stubGlobal("fetch", fetchMock.mockReset().mockResolvedValue(new Response("unreachable", { status: 500 })));
    await expect(verifyCaptcha("")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});