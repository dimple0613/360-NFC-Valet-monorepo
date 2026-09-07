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
  brandName: "content.brand_name",
  copyright: "content.copyright",
  supportEmail: "content.support_email",
  loginTitle: "content.login_title",
  loginSubtitle: "content.login_subtitle",
  loginHeroHeadline: "content.login_hero_headline",
  loginHeroSub: "content.login_hero_sub",
  signupTitle: "content.signup_title",
  signupSubtitle: "content.signup_subtitle",
  signupHeroHeadline: "content.signup_hero_headline",
  signupHeroSub: "content.signup_hero_sub",
  forgotTitle: "content.forgot_title",
  forgotSubtitle: "content.forgot_subtitle",
  forgotHeroHeadline: "content.forgot_hero_headline",
  forgotHeroSub: "content.forgot_hero_sub",
  error404Title: "content.error_404_title",
  error404Body: "content.error_404_body",
  error403Title: "content.error_403_title",
  error403Body: "content.error_403_body",
  error401Title: "content.error_401_title",
  error401Body: "content.error_401_body",
  error500Title: "content.error_500_title",
  error500Body: "content.error_500_body",
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

// --- Branding images: upload-safe storage ---
//
// Logos/favicon can be either a hosted URL or an inlined data URL produced by
// the Super Admin file picker. Data URLs are stored in the platform settings
// row itself, so an uploaded image is served straight out of the database — no
// filesystem path, no case-sensitivity, no ephemeral production disk — which
// kills the "uploaded image 404s in production" failure mode entirely.

export const ALLOWED_BRAND_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

/** Upper bound on the stored data-URL string (chars). ~525 KB of binary image. Stays well below the 1 MB server-action body limit. */
export const MAX_BRAND_IMAGE_DATA_URL_LENGTH = 700_000;

/**
 * Validates + normalizes a logo/favicon setting value. Accepts an inline
 * `data:image/...` data URL (file upload) or an absolute http(s) URL (hosted
 * image). Rejects anything else with a user-facing message. Returns null for
 * empty input.
 */
export function normalizeBrandImage(value: string | null | undefined): string | null {
  const raw = nullableString(value ?? undefined);
  if (raw === null) return null;

  if (raw.startsWith("data:image/")) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,/.exec(raw);
    if (!match) {
      throw new Error("Uploaded image data is invalid.");
    }
    const mime = match[1]!.toLowerCase();
    if (!(ALLOWED_BRAND_IMAGE_MIMES as readonly string[]).includes(mime)) {
      throw new Error(`Unsupported image type "${mime}". Use PNG, JPEG, WebP, GIF, SVG or ICO.`);
    }
    if (raw.length > MAX_BRAND_IMAGE_DATA_URL_LENGTH) {
      throw new Error("Image is too large. Use an image under 500 KB.");
    }
    return raw;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Hosted logos must use http(s).");
    }
    return raw;
  } catch (e) {
    if (e instanceof Error && e.message.includes("http")) throw e;
    throw new Error("Enter a valid URL or upload an image file.");
  }
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

// --- Auth & error page content ---
//
// Every string the login/signup/password-reset forms and the 401/403/404/500
// error pages print is configurable from Settings, so a Super Admin can brand
// those pages without touching code. Unset values fall back to these defaults
// (the current hardcoded copy). getPageContentSettings returns defaults already
// applied, so callers never handle null except for supportEmail.

const AUTH_HERO_HEADLINE = "Every car back at the curb before the guest is.";

export const PAGE_CONTENT_DEFAULTS = {
  brandName: "",
  copyright: "© 2026 We Want 360 · Dubai, UAE",
  supportEmail: "",
  loginTitle: "Welcome back",
  loginSubtitle: "Sign in to your saasclaude account",
  loginHeroHeadline: AUTH_HERO_HEADLINE,
  loginHeroSub:
    "Run every property, driver and NFC card from one console — and see the day's numbers as they happen.",
  signupTitle: "Create your organization",
  signupSubtitle: "Set up your organization in a minute",
  signupHeroHeadline: AUTH_HERO_HEADLINE,
  signupHeroSub: "Set up your organization in a minute.",
  forgotTitle: "Reset your password",
  forgotSubtitle: "We'll email you a link to reset it",
  forgotHeroHeadline: AUTH_HERO_HEADLINE,
  forgotHeroSub: "Reset your password to get back into the operations console.",
  error404Title: "Page not found",
  error404Body: "The page you're looking for doesn't exist or has been moved.",
  error403Title: "Access denied",
  error403Body: "Your account doesn't have permission to view this page.",
  error401Title: "Sign in required",
  error401Body: "You need to sign in to view this page.",
  error500Title: "Something went wrong",
  error500Body: "An unexpected error occurred while loading this page. Please try again.",
} as const;

export type PageContentKey = keyof typeof PAGE_CONTENT_DEFAULTS;

export interface PageContentSettings {
  brandName: string;
  copyright: string;
  supportEmail: string | null;
  loginTitle: string;
  loginSubtitle: string;
  loginHeroHeadline: string;
  loginHeroSub: string;
  signupTitle: string;
  signupSubtitle: string;
  signupHeroHeadline: string;
  signupHeroSub: string;
  forgotTitle: string;
  forgotSubtitle: string;
  forgotHeroHeadline: string;
  forgotHeroSub: string;
  error404Title: string;
  error404Body: string;
  error403Title: string;
  error403Body: string;
  error401Title: string;
  error401Body: string;
  error500Title: string;
  error500Body: string;
}

const CONTENT_KEYS: Record<PageContentKey, string> = {
  brandName: KEYS.brandName,
  copyright: KEYS.copyright,
  supportEmail: KEYS.supportEmail,
  loginTitle: KEYS.loginTitle,
  loginSubtitle: KEYS.loginSubtitle,
  loginHeroHeadline: KEYS.loginHeroHeadline,
  loginHeroSub: KEYS.loginHeroSub,
  signupTitle: KEYS.signupTitle,
  signupSubtitle: KEYS.signupSubtitle,
  signupHeroHeadline: KEYS.signupHeroHeadline,
  signupHeroSub: KEYS.signupHeroSub,
  forgotTitle: KEYS.forgotTitle,
  forgotSubtitle: KEYS.forgotSubtitle,
  forgotHeroHeadline: KEYS.forgotHeroHeadline,
  forgotHeroSub: KEYS.forgotHeroSub,
  error404Title: KEYS.error404Title,
  error404Body: KEYS.error404Body,
  error403Title: KEYS.error403Title,
  error403Body: KEYS.error403Body,
  error401Title: KEYS.error401Title,
  error401Body: KEYS.error401Body,
  error500Title: KEYS.error500Title,
  error500Body: KEYS.error500Body,
};

export async function getPageContentSettings(): Promise<PageContentSettings> {
  const keys = Object.values(CONTENT_KEYS);
  const rows = await Promise.all(
    keys.map((key) => getPlatformSetting<string>(key).then((value) => [key, value] as const)),
  );
  const stored = new Map(rows);
  return Object.fromEntries(
    (Object.keys(CONTENT_KEYS) as PageContentKey[]).map((field) => {
      const key = CONTENT_KEYS[field];
      const fallback = PAGE_CONTENT_DEFAULTS[field] ?? "";
      return [field, nullableString(stored.get(key)) ?? fallback];
    }),
  ) as unknown as PageContentSettings;
}

export async function setPageContentSettings(input: PageContentSettings): Promise<void> {
  await Promise.all(
    (Object.keys(CONTENT_KEYS) as PageContentKey[]).map((field) =>
      setPlatformSetting({
        category: "content",
        key: CONTENT_KEYS[field],
        value: nullableString(input[field] ?? "") ?? "",
      }),
    ),
  );
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
