import { NextResponse } from "next/server";
import type { OrganizationInvite } from "@saasclaude/db";
import { listPendingInvitesPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

function serializeInvite(invite: OrganizationInvite) {
  return {
    id: invite.id,
    email: invite.email,
    roleId: invite.roleId,
    invitedByUserId: invite.invitedByUserId,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.read_members");
  if (denied) return denied;

  const { items, nextCursor } = await listPendingInvitesPage(apiKey.organizationId, parsePageParams(req));
  return NextResponse.json({ invites: items.map(serializeInvite), nextCursor });
});
