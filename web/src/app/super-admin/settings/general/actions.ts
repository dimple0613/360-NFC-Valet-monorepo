"use server";

import { revalidatePath } from "next/cache";
import {
  CAPTCHA_PROVIDERS,
  normalizeBrandImage,
  setAccessSettings,
  setBrandingSettings,
  setInvoiceNumberFormat,
  setPageContentSettings,
  setSecurityDefaultSettings,
  type CaptchaProvider,
  type PageContentSettings,
} from "../../../../lib/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_SETTINGS_PERMISSION = "core.platform.manage_settings";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

/** Validates + normalizes one of the branding image fields — accepts an uploaded inline data URL or a hosted http(s) URL. */
function brandImage(formData: FormData, key: string): string | null {
  return normalizeBrandImage(nullableStr(formData, key));
}

export async function saveBrandingAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  await setBrandingSettings({
    siteName: nullableStr(formData, "siteName"),
    siteDescription: nullableStr(formData, "siteDescription"),
    logoLightUrl: brandImage(formData, "logoLightUrl"),
    logoDarkUrl: brandImage(formData, "logoDarkUrl"),
    faviconUrl: brandImage(formData, "faviconUrl"),
  });
  revalidatePath("/super-admin/settings/general");
  revalidatePath("/super-admin", "layout");
  // Branding/content now also feeds the (auth) pages, error pages and the root
  // layout's favicon/title — revalidate everything so saved changes show up
  // immediately instead of on the next deploy.
  revalidatePath("/", "layout");
}

export async function saveAccessAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  await setAccessSettings({
    registrationEnabled: formData.get("registrationEnabled") === "on",
    maintenanceMode: formData.get("maintenanceMode") === "on",
    maintenanceMessage: nullableStr(formData, "maintenanceMessage"),
  });
  revalidatePath("/super-admin/settings/general");
}

export async function saveBillingAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  await setInvoiceNumberFormat(str(formData, "invoiceNumberFormat"));
  revalidatePath("/super-admin/settings/general");
}

export async function saveSecurityAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);

  const providerRaw = str(formData, "captchaProvider");
  const captchaProvider: CaptchaProvider = (CAPTCHA_PROVIDERS as readonly string[]).includes(providerRaw)
    ? (providerRaw as CaptchaProvider)
    : "none";

  await setSecurityDefaultSettings({
    require2fa: formData.get("require2fa") === "on",
    captchaProvider,
    captchaSiteKey: nullableStr(formData, "captchaSiteKey"),
    // Empty leaves the stored secret untouched.
    captchaSecretKey: nullableStr(formData, "captchaSecretKey"),
  });
  revalidatePath("/super-admin/settings/general");
}

const CONTENT_FIELDS = [
  "brandName",
  "copyright",
  "supportEmail",
  "loginTitle",
  "loginSubtitle",
  "loginHeroHeadline",
  "loginHeroSub",
  "signupTitle",
  "signupSubtitle",
  "signupHeroHeadline",
  "signupHeroSub",
  "forgotTitle",
  "forgotSubtitle",
  "forgotHeroHeadline",
  "forgotHeroSub",
  "error404Title",
  "error404Body",
  "error403Title",
  "error403Body",
  "error401Title",
  "error401Body",
  "error500Title",
  "error500Body",
] as const;

export async function saveContentAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  const content = {} as Record<(typeof CONTENT_FIELDS)[number], string>;
  for (const field of CONTENT_FIELDS) {
    content[field] = nullableStr(formData, field) ?? "";
  }
  await setPageContentSettings(content as unknown as PageContentSettings);
  revalidatePath("/super-admin/settings/general");
  revalidatePath("/", "layout");
}
