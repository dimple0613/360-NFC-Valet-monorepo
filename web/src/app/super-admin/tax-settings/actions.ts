"use server";

import { revalidatePath } from "next/cache";
import { removeTaxRateForCountry, setTaxRateForCountry, setTaxSettings } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_PLANS_PERMISSION = "core.platform.manage_plans";

export async function setTaxSettingsAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  const enabled = formData.get("enabled") === "on";
  const defaultRatePercent = Number(formData.get("defaultRatePercent") ?? 0);
  if (Number.isNaN(defaultRatePercent) || defaultRatePercent < 0) {
    throw new Error("Enter a valid tax rate.");
  }
  await setTaxSettings({ enabled, defaultRatePercent });
  revalidatePath("/super-admin/tax-settings");
}

export async function addTaxRateAction(formData: FormData): Promise<void> {
  await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  const countryCode = String(formData.get("countryCode") ?? "").trim();
  const ratePercent = Number(formData.get("ratePercent") ?? NaN);
  if (!countryCode) throw new Error("Choose a country.");
  if (Number.isNaN(ratePercent) || ratePercent < 0) throw new Error("Enter a valid tax rate.");

  await setTaxRateForCountry(countryCode, ratePercent);
  revalidatePath("/super-admin/tax-settings");
}

export async function removeTaxRateAction(countryCode: string): Promise<void> {
  await requirePlatformAccess(MANAGE_PLANS_PERMISSION);
  await removeTaxRateForCountry(countryCode);
  revalidatePath("/super-admin/tax-settings");
}
