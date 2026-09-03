import { getPlatformSetting, setPlatformSetting } from "./settings";

// General platform settings — the "Settings > General" surface of the Super
// Admin portal (FR-270). Typed read/write helpers over the generic
// platformSetting store, mirroring billing/tax.ts: this is the one place the
// defaults live, so callers never hardcode "INV-{NUMBER}" or "is signup on?"
// logic themselves.
//
// Wired consumers today: formatInvoiceNumber() (billing/invoices.ts),
// isRegistrationEnabled() (web signup-flow), getBrandingSettings().siteName
// (Super Admin shell). maintenance mode, require-2FA and the captcha fields
// are persisted here but not yet enforced anywhere — the General page says
// so inline rather than implying they work.

const KEYS = {
  siteName: "branding.site_name",
  siteDescription: "branding.site_description",
  logoLightUrl: "branding.logo_light_url",
  logoDarkUrl: "branding.logo_dark_url",
  faviconUrl: "branding.favicon_url",
  registrationEnabled: "access.registration_enabled",
  maintenanceMode: "access.maintenance_mode",
  maintenanceMessage: "access.maintenance_message",
  invoiceNumberFormat: "billing.invoice_number_format",
  require2fa: "security.require_2fa",
  captchaProvider: "security.captcha_provider",
  captchaSiteKey: "security.captcha_site_key",
  captchaSecretKey: "security.captcha_secret_key",
} as const;

export const DEFAULT_INVOICE_NUMBER_FORMAT = "INV-{NUMBER}";
/** Zero-padding width for the `{NUMBER}` token — keeps the default output at INV-000001. */
export const INVOICE_NUMBER_SEQUENCE_PAD = 6;

export const CAPTCHA_PROVIDERS = ["none", "recaptcha_v2", "recaptcha_v3", "hcaptcha"] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

function nullableString(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value : null;
}

// --- Branding ---

export interface BrandingSettings {
  siteName: string | null;
  siteDescription: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const [siteName, siteDescription, logoLightUrl, logoDarkUrl, faviconUrl] = await Promise.all([
    getPlatformSetting<string>(KEYS.siteName),
    getPlatformSetting<string>(KEYS.siteDescription),
    getPlatformSetting<string>(KEYS.logoLightUrl),
    getPlatformSetting<string>(KEYS.logoDarkUrl),
    getPlatformSetting<string>(KEYS.faviconUrl),
  ]);
  return {
    siteName: nullableString(siteName),
    siteDescription: nullableString(siteDescription),
    logoLightUrl: nullableString(logoLightUrl),
    logoDarkUrl: nullableString(logoDarkUrl),
    faviconUrl: nullableString(faviconUrl),
  };
}

export async function setBrandingSettings(input: BrandingSettings): Promise<void> {
  await Promise.all([
    setPlatformSetting({ category: "branding", key: KEYS.siteName, value: nullableString(input.siteName ?? undefined) }),
    setPlatformSetting({
      category: "branding",
      key: KEYS.siteDescription,
      value: nullableString(input.siteDescription ?? undefined),
    }),
    setPlatformSetting({
      category: "branding",
      key: KEYS.logoLightUrl,
      value: nullableString(input.logoLightUrl ?? undefined),
    }),
    setPlatformSetting({
      category: "branding",
      key: KEYS.logoDarkUrl,
      value: nullableString(input.logoDarkUrl ?? undefined),
    }),
    setPlatformSetting({
      category: "branding",
      key: KEYS.faviconUrl,
      value: nullableString(input.faviconUrl ?? undefined),
    }),
  ]);
}

// --- Registration & access ---

export interface AccessSettings {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

export async function getAccessSettings(): Promise<AccessSettings> {
  const [registrationEnabled, maintenanceMode, maintenanceMessage] = await Promise.all([
    getPlatformSetting<boolean>(KEYS.registrationEnabled),
    getPlatformSetting<boolean>(KEYS.maintenanceMode),
    getPlatformSetting<string>(KEYS.maintenanceMessage),
  ]);
  return {
    // Unset means open signup — the platform ships usable, an admin opts out.
    registrationEnabled: registrationEnabled !== false,
    maintenanceMode: maintenanceMode === true,
    maintenanceMessage: nullableString(maintenanceMessage),
  };
}

export async function setAccessSettings(input: AccessSettings): Promise<void> {
  await Promise.all([
    setPlatformSetting({ category: "access", key: KEYS.registrationEnabled, value: input.registrationEnabled }),
    setPlatformSetting({ category: "access", key: KEYS.maintenanceMode, value: input.maintenanceMode }),
    setPlatformSetting({
      category: "access",
      key: KEYS.maintenanceMessage,
      value: nullableString(input.maintenanceMessage ?? undefined),
    }),
  ]);
}

/** The one check the self-serve signup path calls — unset defaults to allowed. */
export async function isRegistrationEnabled(): Promise<boolean> {
  return (await getPlatformSetting<boolean>(KEYS.registrationEnabled)) !== false;
}

// --- Billing / invoice numbering ---

export async function getInvoiceNumberFormat(): Promise<string> {
  return (await getPlatformSetting<string>(KEYS.invoiceNumberFormat)) || DEFAULT_INVOICE_NUMBER_FORMAT;
}

export async function setInvoiceNumberFormat(format: string): Promise<void> {
  await setPlatformSetting({
    category: "billing",
    key: KEYS.invoiceNumberFormat,
    value: format.trim() || DEFAULT_INVOICE_NUMBER_FORMAT,
  });
}

/**
 * Renders `sequence` through the configured format. `{NUMBER}` is replaced
 * with the zero-padded sequence; a format with no token gets the number
 * appended, so a bare prefix like "INV-" still works. Used by issueInvoice.
 */
export async function formatInvoiceNumber(sequence: number): Promise<string> {
  const format = await getInvoiceNumberFormat();
  const padded = String(sequence).padStart(INVOICE_NUMBER_SEQUENCE_PAD, "0");
  return format.includes("{NUMBER}") ? format.replace(/\{NUMBER\}/g, padded) : `${format}${padded}`;
}

// --- Security defaults ---

export interface SecurityDefaultSettings {
  require2fa: boolean;
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string | null;
  /** True when a secret key is stored — the value itself is never read back out to the UI. */
  captchaSecretConfigured: boolean;
}

function toCaptchaProvider(value: string | undefined): CaptchaProvider {
  return (CAPTCHA_PROVIDERS as readonly string[]).includes(value ?? "") ? (value as CaptchaProvider) : "none";
}

export async function getSecurityDefaultSettings(): Promise<SecurityDefaultSettings> {
  const [require2fa, captchaProvider, captchaSiteKey, captchaSecretKey] = await Promise.all([
    getPlatformSetting<boolean>(KEYS.require2fa),
    getPlatformSetting<string>(KEYS.captchaProvider),
    getPlatformSetting<string>(KEYS.captchaSiteKey),
    getPlatformSetting<string>(KEYS.captchaSecretKey),
  ]);
  return {
    require2fa: require2fa === true,
    captchaProvider: toCaptchaProvider(captchaProvider),
    captchaSiteKey: nullableString(captchaSiteKey),
    captchaSecretConfigured: nullableString(captchaSecretKey) !== null,
  };
}

export interface SetSecurityDefaultSettingsInput {
  require2fa: boolean;
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string | null;
  /** Omitted / empty leaves the stored secret untouched — matches the generic sensitive-setting edit pattern. */
  captchaSecretKey?: string | null;
}

export async function setSecurityDefaultSettings(input: SetSecurityDefaultSettingsInput): Promise<void> {
  const writes = [
    setPlatformSetting({ category: "security", key: KEYS.require2fa, value: input.require2fa }),
    setPlatformSetting({ category: "security", key: KEYS.captchaProvider, value: input.captchaProvider }),
    setPlatformSetting({
      category: "security",
      key: KEYS.captchaSiteKey,
      value: nullableString(input.captchaSiteKey ?? undefined),
    }),
  ];
  const secret = nullableString(input.captchaSecretKey ?? undefined);
  if (secret !== null) {
    writes.push(
      setPlatformSetting({ category: "security", key: KEYS.captchaSecretKey, value: secret, isSensitive: true }),
    );
  }
  await Promise.all(writes);
}
