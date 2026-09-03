import { NextResponse } from "next/server";
import type { Session } from "@saasclaude/db";
import { listSessionsForOrganizationPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

// An API key is an organization-level credential with no "calling user"
// behind it (unlike a Tenant Admin cookie session) — see the doc comment on
// listSessionsForOrganizationPage in packages/db/src/auth/session.ts. So
// this lists sessions currently active *within the calling organization*,
// optionally narrowed to one member via ?userId=, rather than "my own"
// sessions the way the session-authenticated settings/sessions page does.
function serializeSession(session: Session) {
  return {
    id: session.id,
    userId: session.userId,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  };
}

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.sessions.read");
  if (denied) return denied;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const { items, nextCursor } = await listSessionsForOrganizationPage(apiKey.organizationId, {
    ...parsePageParams(req),
    userId,
  });
  return NextResponse.json({ sessions: items.map(serializeSession), nextCursor });
});
