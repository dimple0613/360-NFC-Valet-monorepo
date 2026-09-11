import { NextResponse } from "next/server";
import {
  AlreadyMemberError,
  inviteUserToOrganization,
  InviteAlreadyPendingError,
  listOrganizationMembersPage,
  resolveEmailSender,
  RoleNotFoundError,
} from "../../../../lib/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";
import { resolveBaseUrl } from "@/lib/base-url";

function serializeMember(membership: {
  id: string;
  status: string;
  createdAt: Date;
  user: { id: string; email: string; name: string | null; mfaEnabled: boolean };
}) {
  return {
    membershipId: membership.id,
    status: membership.status,
    createdAt: membership.createdAt,
    // mfaEnabled: a trivial read of already-fetched User state (listOrganizationMembersPage
    // already includes the full user row) — no new endpoint or service logic needed to expose
    // "is MFA enabled for this member", the read-only MFA status this round's brief asked for.
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      mfaEnabled: membership.user.mfaEnabled,
    },
  };
}

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.read_members");
  if (denied) return denied;

  const { items, nextCursor } = await listOrganizationMembersPage(apiKey.organizationId, parsePageParams(req));
  return NextResponse.json({ members: items.map(serializeMember), nextCursor });
});

export const POST = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.manage_members");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const roleId = typeof body?.roleId === "string" ? body.roleId : undefined;
  if (!email) {
    return NextResponse.json({ error: "'email' is required and must be a non-empty string." }, { status: 400 });
  }

  try {
    const { inviteId, deliveryError } = await inviteUserToOrganization(
      {
        organizationId: apiKey.organizationId,
        email,
        roleId,
        acceptUrlBuilder: (token) => `${resolveBaseUrl()}/invite/accept?token=${token}`,
      },
      await resolveEmailSender(),
    );
    return NextResponse.json({ inviteId, emailDelivered: !deliveryError, ...(deliveryError ? { deliveryError } : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof RoleNotFoundError) {
      return NextResponse.json({ error: "No role with that id in this organization." }, { status: 400 });
    }
    if (error instanceof AlreadyMemberError || error instanceof InviteAlreadyPendingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});
