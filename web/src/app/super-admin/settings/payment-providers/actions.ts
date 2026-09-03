"use server";

import { revalidatePath } from "next/cache";
import { getPaymentProviderAdapter, setPaymentProviderConfigValue, setPaymentProviderEnabled } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_PAYMENT_PROVIDERS_PERMISSION = "core.platform.manage_payment_providers";

export interface SavePaymentProviderConfigFormState {
  error: string | null;
}

/**
 * One action serves every registered adapter — which fields to read off the
 * form comes from `getPaymentProviderAdapter(adapterId).configFields`, not a
 * hardcoded per-provider field list, so a brand-new adapter needs zero
 * changes here. Blank fields are left untouched (same convention the
 * OAuth providers form and the generic platform-settings form already use
 * for sensitive values) so re-saving the enabled toggle doesn't force
 * re-entering the client secret every time. Direct structural mirror of
 * super-admin/settings/auth-providers/actions.ts.
 */
export async function savePaymentProviderConfigAction(
  _prevState: SavePaymentProviderConfigFormState,
  formData: FormData,
): Promise<SavePaymentProviderConfigFormState> {
  try {
    await requirePlatformAccess(MANAGE_PAYMENT_PROVIDERS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const adapterId = String(formData.get("adapterId") ?? "");
  const adapter = getPaymentProviderAdapter(adapterId);
  if (!adapter) return { error: "Unknown payment provider." };

  for (const field of adapter.configFields) {
    const raw = formData.get(`field_${field.key}`);
    if (typeof raw === "string" && raw.trim()) {
      await setPaymentProviderConfigValue({ adapterId, field: field.key, value: raw.trim(), sensitive: field.sensitive });
    }
  }

  const enabled = formData.get("enabled") === "on";
  await setPaymentProviderEnabled(adapterId, enabled);

  revalidatePath("/super-admin/settings/payment-providers");
  return { error: null };
}
