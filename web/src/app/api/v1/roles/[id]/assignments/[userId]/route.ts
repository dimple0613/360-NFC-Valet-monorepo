import { NextResponse } from "next/server";
import { unassignRoleFromUser, UserRoleNotFoundError } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export const DELETE = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { id: roleId, userId } = await ctx.params;
  try {
    await unassignRoleFromUser(apiKey.organizationId, roleId, userId);
  } catch (error) {
    if (error instanceof UserRoleNotFoundError) {
      return NextResponse.json({ error: "That role is not assigned to that user." }, { status: 404 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
