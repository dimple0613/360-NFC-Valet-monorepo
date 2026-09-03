import { NextResponse } from "next/server";
import { getEnabledFeaturesForContext } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

// FR-192's "available to ... frontend" bootstrap payload, exposed to an
// external API client for the first time — getEnabledFeaturesForContext
// already existed with zero callers anywhere in web/. Read-only: no module
// registers any Feature yet (the catalog can be genuinely empty), and no
// override-management UI exists to pair a write endpoint with, so this
// stays a read-only surface until one does.
export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.features.read");
  if (denied) return denied;

  const enabled = await getEnabledFeaturesForContext({ organizationId: apiKey.organizationId });
  return NextResponse.json({ enabled });
});
