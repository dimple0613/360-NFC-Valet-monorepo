import { NextResponse } from "next/server";
import { cancelInvite, InviteNotFoundError } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.manage_members");
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await cancelInvite(apiKey.organizationId, id);
  } catch (error) {
    if (error instanceof InviteNotFoundError) {
      return NextResponse.json({ error: "No pending invite with that id." }, { status: 404 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
