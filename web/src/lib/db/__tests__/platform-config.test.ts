import { afterEach, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  DEFAULT_INVOICE_NUMBER_FORMAT,
  formatInvoiceNumber,
  getBrandingSettings,
  getSecurityDefaultSettings,
  isRegistrationEnabled,
  setBrandingSettings,
  setInvoiceNumberFormat,
  setSecurityDefaultSettings,
} from "../platform-config";
import { getPlatformSetting, setPlatformSetting } from "../settings";

// Platform settings are global (not tenant-scoped) and these tests mutate a
// fixed key set — every test restores it, and the db suites run serialized
// (see the root CLAUDE.md), so this can't race the invoice-numbering tests.
const TOUCHED_KEYS = [
  "branding.site_name",
  "branding.site_description",
  "branding.logo_light_url",
  "branding.logo_dark_url",
  "branding.favicon_url",
  "access.registration_enabled",
  "billing.invoice_number_format",
  "security.require_2fa",
  "security.captcha_provider",
  "security.captcha_site_key",
  "security.captcha_secret_key",
];

describe("platform-config (Settings > General)", () => {
  afterEach(async () => {
    await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key: { in: TOUCHED_KEYS } } });
  });

  describe("formatInvoiceNumber", () => {
    it("uses the default INV-000001 shape when nothing is configured", async () => {
      await expect(formatInvoiceNumber(1)).resolves.toBe("INV-000001");
      await expect(formatInvoiceNumber(42)).resolves.toBe("INV-000042");
    });

    it("renders the configured {NUMBER} template", async () => {
      await setInvoiceNumberFormat("ACME/{NUMBER}/2026");
      await expect(formatInvoiceNumber(7)).resolves.toBe("ACME/000007/2026");
    });

    it("appends the number when the template has no token", async () => {
      await setInvoiceNumberFormat("INVOICE-");
      await expect(formatInvoiceNumber(9)).resolves.toBe("INVOICE-000009");
    });

    it("falls back to the default when set to an empty string", async () => {
      await setInvoiceNumberFormat("   ");
      expect(await getPlatformSetting<string>("billing.invoice_number_format")).toBe(DEFAULT_INVOICE_NUMBER_FORMAT);
    });
  });

  describe("isRegistrationEnabled", () => {
    it("defaults to true when unset", async () => {
      await expect(isRegistrationEnabled()).resolves.toBe(true);
    });

    it("is false only when explicitly disabled", async () => {
      await setPlatformSetting({ category: "access", key: "access.registration_enabled", value: false });
      await expect(isRegistrationEnabled()).resolves.toBe(false);

      await setPlatformSetting({ category: "access", key: "access.registration_enabled", value: true });
      await expect(isRegistrationEnabled()).resolves.toBe(true);
    });
  });

  describe("branding", () => {
    it("round-trips values and normalises blanks to null", async () => {
      await setBrandingSettings({
        siteName: "Acme Platform",
        siteDescription: "  ",
        logoLightUrl: "https://cdn.example.com/light.svg",
        logoDarkUrl: null,
        faviconUrl: "",
      });

      const branding = await getBrandingSettings();
      expect(branding.siteName).toBe("Acme Platform");
      expect(branding.siteDescription).toBeNull();
      expect(branding.logoLightUrl).toBe("https://cdn.example.com/light.svg");
      expect(branding.logoDarkUrl).toBeNull();
      expect(branding.faviconUrl).toBeNull();
    });
  });

  describe("security defaults", () => {
    it("stores the captcha secret encrypted and only reports it as configured", async () => {
      await setSecurityDefaultSettings({
        require2fa: true,
        captchaProvider: "hcaptcha",
        captchaSiteKey: "site-key-123",
        captchaSecretKey: "super-secret",
      });

      const security = await getSecurityDefaultSettings();
      expect(security.require2fa).toBe(true);
      expect(security.captchaProvider).toBe("hcaptcha");
      expect(security.captchaSiteKey).toBe("site-key-123");
      expect(security.captchaSecretConfigured).toBe(true);

      const row = await prismaWithoutTenantScoping.platformSetting.findUniqueOrThrow({
        where: { key: "security.captcha_secret_key" },
      });
      expect(row.isSensitive).toBe(true);
      expect(row.value).not.toContain("super-secret");
    });

    it("leaves the stored secret untouched when the secret field is omitted", async () => {
      await setSecurityDefaultSettings({
        require2fa: false,
        captchaProvider: "recaptcha_v2",
        captchaSiteKey: "site-key-123",
        captchaSecretKey: "first-secret",
      });
      await setSecurityDefaultSettings({
        require2fa: false,
        captchaProvider: "recaptcha_v2",
        captchaSiteKey: "site-key-456",
      });

      const security = await getSecurityDefaultSettings();
      expect(security.captchaSiteKey).toBe("site-key-456");
      expect(security.captchaSecretConfigured).toBe(true);
      expect(await getPlatformSetting<string>("security.captcha_secret_key")).toBe("first-secret");
    });

    it("coerces an unknown captcha provider to none", async () => {
      await setPlatformSetting({ category: "security", key: "security.captcha_provider", value: "bogus" });
      const security = await getSecurityDefaultSettings();
      expect(security.captchaProvider).toBe("none");
    });
  });
});
