import { NextResponse } from "next/server";
import { assignRoleToUser, RoleNotFoundError, UserNotAMemberError } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

/** Body: { userId: string }. */
export const POST = withApiTenantContext<RouteContext>(async (req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { id: roleId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : undefined;
  if (!userId) {
    return NextResponse.json({ error: "'userId' is required and must be a non-empty string." }, { status: 400 });
  }

  try {
    await assignRoleToUser(apiKey.organizationId, roleId, userId);
  } catch (error) {
    if (error instanceof RoleNotFoundError) return NextResponse.json({ error: "No role with that id." }, { status: 404 });
    if (error instanceof UserNotAMemberError) {
      return NextResponse.json({ error: "That user is not an active member of this organization." }, { status: 400 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
