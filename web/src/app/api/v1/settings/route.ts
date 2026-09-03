import { NextResponse } from "next/server";
import { listOrganizationSettings } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.settings.read");
  if (denied) return denied;

  const settings = await listOrganizationSettings(apiKey.organizationId);
  return NextResponse.json({ settings });
});
