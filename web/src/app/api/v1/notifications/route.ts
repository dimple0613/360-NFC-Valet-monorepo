import { NextResponse } from "next/server";
import type { InAppNotification } from "@saasclaude/db";
import { listInAppNotificationsPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

// Same "no calling user" reasoning as /api/v1/sessions: lists the
// organization's in-app notification feed, optionally narrowed to one
// member via ?userId=, rather than "my own" notifications.
function serializeNotification(notification: InAppNotification) {
  return {
    id: notification.id,
    userId: notification.userId,
    kind: notification.kind,
    subject: notification.subject,
    body: notification.body,
    createdAt: notification.createdAt,
  };
}

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.notifications.read");
  if (denied) return denied;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const { items, nextCursor } = await listInAppNotificationsPage(apiKey.organizationId, {
    ...parsePageParams(req),
    userId,
  });
  return NextResponse.json({ notifications: items.map(serializeNotification), nextCursor });
});
