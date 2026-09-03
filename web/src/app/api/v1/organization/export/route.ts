import { NextResponse } from "next/server";
import { exportOrganizationData } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

// FR-132/GDPR data portability: a real, if not GDPR-complete, snapshot of
// what this org's own data looks like today (organization profile, roles,
// memberships) — grows as more tenant-scoped models are added. A separate,
// more sensitive scope than core.organization.read: reading the profile and
// exporting a full data snapshot are different capabilities.
export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.export_data");
  if (denied) return denied;

  const data = await exportOrganizationData(apiKey.organizationId);
  return NextResponse.json(data);
});
