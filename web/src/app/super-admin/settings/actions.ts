"use server";

import { revalidatePath } from "next/cache";
import { setPlatformSetting } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_SETTINGS_PERMISSION = "core.platform.manage_settings";

export interface SetPlatformSettingFormState {
  error: string | null;
}

/** Parses the raw form value as JSON (numbers/booleans/quoted strings/objects) — falls back to the raw string when it isn't valid JSON, so "30" and "true" behave as an admin would expect but plain text still works with no special syntax. */
function parseSettingValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function setPlatformSettingAction(
  _prevState: SetPlatformSettingFormState,
  formData: FormData,
): Promise<SetPlatformSettingFormState> {
  try {
    await requirePlatformAccess(MANAGE_SETTINGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const category = String(formData.get("category") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "");
  const isSensitive = formData.get("isSensitive") === "on";

  if (!category) return { error: "A category is required." };
  if (!key) return { error: "A key is required." };
  if (!rawValue.trim()) return { error: "A value is required." };

  await setPlatformSetting({ category, key, value: parseSettingValue(rawValue), isSensitive });

  revalidatePath("/super-admin/settings");
  return { error: null };
}
