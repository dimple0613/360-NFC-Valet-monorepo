import { unsafeRunWithoutTenantScoping } from "./tenant-context";
import { writeAuditLog } from "./audit-log";

// FR-104: a cross-tenant access attempt returns 404 (not 403) and is audit-logged.
// The scoping layer already makes a cross-tenant lookup return null/empty rather
// than the other org's row — from the caller's side that's indistinguishable from
// the resource genuinely not existing anywhere. This helper tells the two apart
// (by re-checking, unscoped, only after the scoped lookup came back empty) so we
// can audit-log the interesting case (someone reached for another org's data)
// without logging every ordinary 404 (a typo'd id that exists nowhere).

export interface CrossTenantAuditContext {
  module: string;
  resourceType: string;
  resourceId: string;
  actorUserId?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Runs a tenant-scoped lookup that already returned null/empty. If the resource
 * actually exists in some other organization, writes an audit log entry noting
 * the attempt. Always returns void — the caller already has its null/empty
 * result and should translate that into a 404 response regardless of whether
 * this turns out to have been a cross-tenant attempt or a plain not-found.
 */
export async function auditIfCrossTenantAttempt(
  unscopedExistsCheck: () => Promise<boolean>,
  context: CrossTenantAuditContext,
): Promise<void> {
  const existsInAnotherTenant = await unsafeRunWithoutTenantScoping(async () => unscopedExistsCheck());
  if (!existsInAnotherTenant) return;

  await writeAuditLog({
    module: context.module,
    action: "cross_tenant_access_denied",
    actorUserId: context.actorUserId,
    resourceType: context.resourceType,
    resourceId: context.resourceId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}
