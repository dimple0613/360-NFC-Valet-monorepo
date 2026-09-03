import { db } from "../client";
import { runWithTenant } from "../tenant-context";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "../pagination";
import { registerNotificationChannel } from "./channel-registry";
import type { NotificationChannel, NotificationMessage, NotificationSendResult } from "./channel";
import type { InAppNotification } from "../../generated/client";

// The "in-app" notification channel (REQUIREMENTS.md §2.14) — the minimal
// real surface a user can actually see a notification in the product,
// backed by the InAppNotification table (schema.prisma), tenant-scoped per
// CLAUDE.md's "tenant context travels with async work... including
// notifications." Unlike email/webhook, this channel needs no external
// account or config at all — it only ever writes to this platform's own
// database — so it has zero configFields and is always "configured".

export const ADAPTER_ID = "in-app";

export const inAppNotificationChannel: NotificationChannel = {
  id: ADAPTER_ID,
  displayName: "In-app",
  configFields: [],
  async isConfigured() {
    return true;
  },
  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    if (!message.organizationId || !message.userId) {
      return { ok: false, skipped: true, error: "In-app notifications need both organizationId and userId." };
    }
    await runWithTenant(message.organizationId, async () => {
      await db.inAppNotification.create({
        data: {
          organizationId: message.organizationId!,
          userId: message.userId!,
          kind: message.kind,
          subject: message.subject,
          body: message.body,
        },
      });
    });
    return { ok: true };
  },
};

/** Tenant Admin UI: a user's in-app notification feed for the active org, newest first. Deliberately no read/unread state or pagination this round — see TASKS.md, "keep this minimal." */
export async function listInAppNotifications(organizationId: string, userId: string, limit = 50) {
  return runWithTenant(organizationId, async () =>
    db.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
}

/**
 * Cursor-paginated variant for REST — an API key is an org-level credential
 * with no "calling user" behind it (see session.ts's matching comment on
 * listSessionsForOrganizationPage), so this lists every in-app notification
 * across the organization, newest first, optionally narrowed to one member
 * via `params.userId`. `db` here is the tenant-scoped Prisma client
 * (InAppNotification is in tenant-scoping.ts's TENANT_SCOPED_MODELS), so
 * runWithTenant(organizationId, ...) is what makes this safe by
 * construction — no other org's rows can ever surface here.
 */
export async function listInAppNotificationsPage(
  organizationId: string,
  params: PageParams & { userId?: string } = {},
): Promise<PageResult<InAppNotification>> {
  const limit = clampPageLimit(params.limit);
  return runWithTenant(organizationId, async () => {
    const rows = await db.inAppNotification.findMany({
      where: params.userId ? { userId: params.userId } : {},
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    return toPageResult(rows, limit);
  });
}

// Self-registration: importing this module (which packages/db/src/index.ts
// does) is enough to make the in-app channel dispatched to by notify.ts —
// no other file needs to change.
registerNotificationChannel(inAppNotificationChannel);
