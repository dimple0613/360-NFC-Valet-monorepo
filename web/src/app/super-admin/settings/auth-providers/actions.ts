"use server";

import { revalidatePath } from "next/cache";
import { getOAuthAdapter, setOAuthProviderConfigValue, setOAuthProviderEnabled } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_AUTH_PROVIDERS_PERMISSION = "core.platform.manage_auth_providers";

export interface SaveOAuthProviderConfigFormState {
  error: string | null;
}

/**
 * One action serves every registered adapter — which fields to read off the
 * form comes from `getOAuthAdapter(adapterId).configFields`, not a
 * hardcoded per-provider field list, so a brand-new adapter needs zero
 * changes here. Blank fields are left untouched (same convention the
 * generic platform-settings form already uses for sensitive values) so
 * re-saving the enabled toggle doesn't force re-entering the client secret
 * every time.
 */
export async function saveOAuthProviderConfigAction(
  _prevState: SaveOAuthProviderConfigFormState,
  formData: FormData,
): Promise<SaveOAuthProviderConfigFormState> {
  try {
    await requirePlatformAccess(MANAGE_AUTH_PROVIDERS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const adapterId = String(formData.get("adapterId") ?? "");
  const adapter = getOAuthAdapter(adapterId);
  if (!adapter) return { error: "Unknown authentication provider." };

  for (const field of adapter.configFields) {
    const raw = formData.get(`field_${field.key}`);
    if (typeof raw === "string" && raw.trim()) {
      await setOAuthProviderConfigValue({ adapterId, field: field.key, value: raw.trim(), sensitive: field.sensitive });
    }
  }

  const enabled = formData.get("enabled") === "on";
  await setOAuthProviderEnabled(adapterId, enabled);

  revalidatePath("/super-admin/settings/auth-providers");
  return { error: null };
}
