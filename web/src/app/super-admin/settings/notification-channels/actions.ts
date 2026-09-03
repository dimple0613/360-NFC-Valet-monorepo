"use server";

import { revalidatePath } from "next/cache";
import { getNotificationChannel, setNotificationChannelConfigValue, setNotificationChannelEnabled } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_NOTIFICATION_CHANNELS_PERMISSION = "core.platform.manage_notification_channels";

export interface SaveNotificationChannelConfigFormState {
  error: string | null;
}

/**
 * One action serves every registered channel — which fields to read off the
 * form comes from `getNotificationChannel(channelId).configFields`, not a
 * hardcoded per-channel field list, so a brand-new channel needs zero
 * changes here. Direct structural mirror of
 * super-admin/settings/auth-providers/actions.ts.
 */
export async function saveNotificationChannelConfigAction(
  _prevState: SaveNotificationChannelConfigFormState,
  formData: FormData,
): Promise<SaveNotificationChannelConfigFormState> {
  try {
    await requirePlatformAccess(MANAGE_NOTIFICATION_CHANNELS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const channelId = String(formData.get("channelId") ?? "");
  const channel = getNotificationChannel(channelId);
  if (!channel) return { error: "Unknown notification channel." };

  for (const field of channel.configFields) {
    const raw = formData.get(`field_${field.key}`);
    if (typeof raw === "string" && raw.trim()) {
      await setNotificationChannelConfigValue({ channelId, field: field.key, value: raw.trim(), sensitive: field.sensitive });
    }
  }

  const enabled = formData.get("enabled") === "on";
  await setNotificationChannelEnabled(channelId, enabled);

  revalidatePath("/super-admin/settings/notification-channels");
  return { error: null };
}
