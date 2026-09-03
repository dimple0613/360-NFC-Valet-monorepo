import { NextResponse } from "next/server";
import { listAuditLogsForOrganizationPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

function serializeAuditLog(row: {
  id: string;
  actorUserId: string | null;
  module: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date;
}) {
  // Deliberately not the full row: before/after diffs, ipAddress, userAgent,
  // and metadata stay off the REST surface by default — same "safe" subset
  // the Super Admin cross-org Report/Log viewer already exposes
  // (audit-log.ts's PlatformAuditLogRow), not a new, wider precedent.
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    module: row.module,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    createdAt: row.createdAt,
  };
}

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.audit_log.read");
  if (denied) return denied;

  const { items, nextCursor } = await listAuditLogsForOrganizationPage(apiKey.organizationId, parsePageParams(req));
  return NextResponse.json({ auditLogs: items.map(serializeAuditLog), nextCursor });
});
