"use server";

import { revalidatePath } from "next/cache";
import {
  CAPTCHA_PROVIDERS,
  setAccessSettings,
  setBrandingSettings,
  setInvoiceNumberFormat,
  setSecurityDefaultSettings,
  type CaptchaProvider,
} from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_SETTINGS_PERMISSION = "core.platform.manage_settings";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableStr(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === "" ? null : value;
}

export async function saveBrandingAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  await setBrandingSettings({
    siteName: nullableStr(formData, "siteName"),
    siteDescription: nullableStr(formData, "siteDescription"),
    logoLightUrl: nullableStr(formData, "logoLightUrl"),
    logoDarkUrl: nullableStr(formData, "logoDarkUrl"),
    faviconUrl: nullableStr(formData, "faviconUrl"),
  });
  revalidatePath("/super-admin/settings/general");
  revalidatePath("/super-admin", "layout");
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
