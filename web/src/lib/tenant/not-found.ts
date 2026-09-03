import { NextResponse } from "next/server";
import { auditIfCrossTenantAttempt, type CrossTenantAuditContext } from "@saasclaude/db";

// FR-104: a resource lookup that came back empty from the tenant-scoped client
// becomes a 404 either way (never a 403 — don't confirm the resource exists
// elsewhere), but gets audit-logged first if it turns out to be a genuine
// cross-tenant reach rather than a plain not-found. Route handlers doing a
// scoped-lookup-or-404 should use this instead of hand-rolling the check.
export async function resourceNotFound(
  unscopedExistsCheck: () => Promise<boolean>,
  audit: CrossTenantAuditContext,
): Promise<NextResponse> {
  await auditIfCrossTenantAttempt(unscopedExistsCheck, audit);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
