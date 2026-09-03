import { NextResponse } from "next/server";
import { ApiKeyNotFoundError, revokeApiKey } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.api_keys.manage");
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await revokeApiKey(apiKey.organizationId, id);
  } catch (error) {
    if (error instanceof ApiKeyNotFoundError) {
      return NextResponse.json({ error: "No API key with that id." }, { status: 404 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
