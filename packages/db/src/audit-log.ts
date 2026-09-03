import { db, prismaWithoutTenantScoping } from "./client";
import {
  clampListPageSize,
  clampPage,
  toCreatedAtDateRangeFilter,
  toListQueryResult,
  toSkipTake,
  type ListQueryParams,
  type ListQueryResult,
} from "./list-query";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "./pagination";
import { runWithTenant } from "./tenant-context";
import type { AuditLog, Prisma } from "../generated/client";

// FR-280/FR-282: a single write path for the audit trail, used by mutation
// paths and by the cross-tenant-access guard (cross-tenant.ts). Goes through
// `db` (the tenant-scoped client) so organizationId comes from whatever
// tenant context is active — same as any other write.
//
// actorUserId is an explicit parameter, not pulled from an ambient "current
// user" context, because no such context exists yet (that lands with Phase 1B
// auth/sessions). Callers pass what they have; pass null/omit for
// system-initiated actions with no human actor.

export interface AuditLogInput {
  module: string;
  action: string;
  actorUserId?: string | null;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: unknown;
}

export async function writeAuditLog(input: AuditLogInput) {
  return db.auditLog.create({
    data: {
      module: input.module,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      before: input.before as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      after: input.after as any,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: input.metadata as any,
      // organizationId is required by the column but gets overwritten by the scoping
      // extension from the active tenant context regardless of this value — as long as
      // a real tenant context is active. This helper assumes it is (throws
      // MissingTenantContextError otherwise, same as any other tenant-scoped write). It
      // is NOT safe to call from inside unsafeRunWithoutTenantScoping: bypass mode skips
      // the override and this placeholder would be written as-is. Bypass-mode/platform-
      // level audit writes should go through db.auditLog.create directly with a real
      // organizationId instead of this helper.
      organizationId: "",
    },
  });
}

/** Tenant Admin dashboard: the org's most recent audit-log entries. Goes through `db` so it's naturally tenant-scoped to whatever context is active. */
export async function listRecentAuditLogs(limit = 10) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/** REST: cursor-paginated variant of listRecentAuditLogs, for an API client browsing its own org's full trail rather than just the dashboard's capped "recent N". Wraps its own runWithTenant (unlike listRecentAuditLogs, which relies on the caller's) so it's safe to call directly, matching listInAppNotificationsPage/listSessionsForOrganizationPage's convention. */
export async function listAuditLogsForOrganizationPage(
  organizationId: string,
  params: PageParams = {},
): Promise<PageResult<AuditLog>> {
  const limit = clampPageLimit(params.limit);
  return runWithTenant(organizationId, async () => {
    const rows = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    return toPageResult(rows, limit);
  });
}

export interface PlatformAuditLogRow {
  id: string;
  organizationId: string;
  organizationName: string;
  actorUserId: string | null;
  actorEmail: string | null;
  module: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date;
}

const PLATFORM_AUDIT_LOG_SORT_FIELDS = ["createdAt", "module", "action"] as const;

/**
 * Super Admin "Report > Log": every organization's audit trail, in one
 * cross-org feed. AuditLog deliberately has no FK relations to Organization
 * or User (so the trail survives deletion of either — see the model's own
 * doc comment in schema.prisma), so organization/actor names can't be
 * `include`d the way listAllInvoicesSearch/listAllTenantRolesSearch do —
 * resolved via a separate batch lookup instead, scoped to just the current
 * page's rows (never the full table).
 */
export async function listAllAuditLogsSearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<PlatformAuditLogRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLATFORM_AUDIT_LOG_SORT_FIELDS.includes(params.sortBy as (typeof PLATFORM_AUDIT_LOG_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof PLATFORM_AUDIT_LOG_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";

  let where: Prisma.AuditLogWhereInput = {};
  if (params.q) {
    const matchingOrgs = await prismaWithoutTenantScoping.organization.findMany({
      where: { name: { contains: params.q, mode: "insensitive" as const } },
      select: { id: true },
    });
    where.OR = [
      { module: { contains: params.q, mode: "insensitive" as const } },
      { action: { contains: params.q, mode: "insensitive" as const } },
      { resourceType: { contains: params.q, mode: "insensitive" as const } },
      { organizationId: { in: matchingOrgs.map((o) => o.id) } },
    ];
  }
  if (params.module) where.module = params.module;
  if (params.action) where.action = params.action;
  const createdRange = toCreatedAtDateRangeFilter(params);
  if (createdRange.gte || createdRange.lt) where.createdAt = createdRange;

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.auditLog.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.auditLog.count({ where }),
  ]);

  const orgIds = [...new Set(rows.map((r) => r.organizationId))];
  const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => id !== null))];
  const [organizations, actors] = await Promise.all([
    prismaWithoutTenantScoping.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
    prismaWithoutTenantScoping.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }),
  ]);
  const orgNameById = new Map(organizations.map((o) => [o.id, o.name]));
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  const items: PlatformAuditLogRow[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    // A deleted org's id has no row to resolve — the trail survives it by
    // design (see the model comment), so the UI shows the bare id rather
    // than silently dropping or mislabeling the entry.
    organizationName: orgNameById.get(r.organizationId) ?? `(deleted org ${r.organizationId})`,
    actorUserId: r.actorUserId,
    actorEmail: r.actorUserId ? (actorEmailById.get(r.actorUserId) ?? `(deleted user ${r.actorUserId})`) : null,
    module: r.module,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    createdAt: r.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}
