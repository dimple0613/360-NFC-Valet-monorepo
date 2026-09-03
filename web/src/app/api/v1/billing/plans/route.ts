import { NextResponse } from "next/server";
import { listPlans } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.billing.read");
  if (denied) return denied;

  // Plans are global/platform-defined (FR-180-183), not tenant-owned — every
  // authenticated key sees the same PUBLIC catalog, same as the Tenant Admin
  // billing page.
  const plans = await listPlans({ visibility: ["PUBLIC"] });
  return NextResponse.json({
    plans: plans.map((p) => ({
      key: p.key,
      name: p.name,
      type: p.type,
      priceCents: p.priceCents,
      currency: p.currency,
      billingCycle: p.billingCycle,
      resources: p.resources.map((r) => ({ resourceTypeKey: r.resourceTypeKey, limit: r.limit })),
      features: p.features.map((f) => ({ featureId: f.featureId, enabled: f.enabled })),
    })),
  });
});
