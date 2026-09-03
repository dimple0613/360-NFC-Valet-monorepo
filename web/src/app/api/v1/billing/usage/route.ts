import { NextResponse } from "next/server";
import { getResourceUsageSummary } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

// One request instead of one per resource type: every registered resource
// type's current usage + the limit resolved from the org's active
// subscription (null = unlimited), the same shape the Tenant Admin
// dashboard's seats card composes by hand today.
export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.billing.read");
  if (denied) return denied;

  const usage = await getResourceUsageSummary(apiKey.organizationId);
  return NextResponse.json({ usage });
});
