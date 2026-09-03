"use server";

import { revalidatePath } from "next/cache";
import { setUserSetting } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { NOTIFICATION_CATEGORIES } from "./categories";

export interface UpdateNotificationPreferencesState {
  error: string | null;
  success: boolean;
}

// FR-190/271-style preference storage over the existing per-user Settings
// scope. Read directly by sendNotification (packages/db/src/notifications/
// notify.ts) via the same `notifications.<category>` key this action writes
// — a category set to `false` here skips every channel for any notification
// kind registered under it (NotificationKind.category).
export async function updateNotificationPreferencesAction(
  _prevState: UpdateNotificationPreferencesState,
  formData: FormData,
): Promise<UpdateNotificationPreferencesState> {
  const identity = await requireIdentity();

  await Promise.all(
    NOTIFICATION_CATEGORIES.map((category) =>
      setUserSetting(identity.user.id, {
        category: "notifications",
        key: `notifications.${category.key}`,
        value: formData.get(category.key) === "on",
      }),
    ),
  );

  revalidatePath("/tenant-admin/settings/notifications");
  return { error: null, success: true };
}
