import { NextResponse } from "next/server";
import { revokeSessionForOrganization, SessionNotFoundError } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.sessions.manage");
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await revokeSessionForOrganization(apiKey.organizationId, id);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "No session with that id." }, { status: 404 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
