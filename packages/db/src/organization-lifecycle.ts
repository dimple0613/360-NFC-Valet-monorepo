import type { Organization, OrganizationStatus, Prisma } from "../generated/client";
import { prismaWithoutTenantScoping, db } from "./client";
import { runWithTenant } from "./tenant-context";
import { writeAuditLog } from "./audit-log";
import { eventBus } from "./event-bus";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "./list-query";

// FR-132: organization create/suspend/reactivate/archive/delete-with-grace-period,
// FR-133: each transition is audit-logged (via runWithTenant, since these are
// typically Super Admin actions with no ambient tenant context of their own) and
// published on the event bus for modules/plugins to react to.
//
// These mutate the Organization row itself through the raw client, not `db` —
// Organization isn't in the tenant-scoping extension's model list (it IS the
// tenant, not a thing scoped by one), same as everywhere else in this codebase.

export class OrganizationNotFoundError extends Error {
  constructor(organizationId: string) {
    super(`No organization with id ${organizationId}.`);
    this.name = "OrganizationNotFoundError";
  }
}

export class InvalidOrganizationTransitionError extends Error {
  constructor(action: string, currentStatus: string, allowedStatuses: readonly string[]) {
    super(
      `Cannot ${action} an organization with status ${currentStatus} ` +
        `(requires one of: ${allowedStatuses.join(", ")}).`,
    );
    this.name = "InvalidOrganizationTransitionError";
  }
}

export interface LifecycleActionContext {
  actorUserId?: string | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Atomic compare-and-set transition: avoids a read-then-write race between concurrent callers. */
async function transitionOrganization(params: {
  organizationId: string;
  action: string;
  allowedFromStatuses: readonly OrganizationStatus[];
  data: Prisma.OrganizationUpdateInput;
}): Promise<Organization> {
  const { count } = await prismaWithoutTenantScoping.organization.updateMany({
    where: { id: params.organizationId, status: { in: [...params.allowedFromStatuses] } },
    data: params.data,
  });

  if (count === 0) {
    const org = await prismaWithoutTenantScoping.organization.findUnique({
      where: { id: params.organizationId },
    });
    if (!org) throw new OrganizationNotFoundError(params.organizationId);
    throw new InvalidOrganizationTransitionError(params.action, org.status, params.allowedFromStatuses);
  }

  return prismaWithoutTenantScoping.organization.findUniqueOrThrow({
    where: { id: params.organizationId },
  });
}

async function auditAndEmit(
  organizationId: string,
  event: string,
  context: LifecycleActionContext | undefined,
  eventPayload: Record<string, unknown> = {},
): Promise<void> {
  await runWithTenant(organizationId, async () => {
    await writeAuditLog({
      module: "core",
      action: event,
      actorUserId: context?.actorUserId,
      resourceType: "Organization",
      resourceId: organizationId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: context?.reason ? { reason: context.reason } : undefined,
    });
  });
  await eventBus.emit(event, { organizationId, ...eventPayload });
}

export async function createOrganization(
  input: { name: string; slug: string; metadata?: unknown },
  context?: LifecycleActionContext,
): Promise<Organization> {
  const organization = await prismaWithoutTenantScoping.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
      status: "ACTIVE",
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
  await auditAndEmit(organization.id, "organization.created", context);
  return organization;
}

const ORGANIZATION_SORT_FIELDS = ["createdAt", "name", "status"] as const;

/** Super Admin platform-wide organization list: offset-paginated, searchable (name/slug), sortable. */
export async function listOrganizationsSearch(params: ListQueryParams = {}): Promise<ListQueryResult<Organization>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = ORGANIZATION_SORT_FIELDS.includes(params.sortBy as (typeof ORGANIZATION_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof ORGANIZATION_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = params.q
    ? {
        OR: [
          { name: { contains: params.q, mode: "insensitive" as const } },
          { slug: { contains: params.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.organization.findMany({ where, orderBy: { [sortBy]: sortDir }, ...toSkipTake(page, pageSize) }),
    prismaWithoutTenantScoping.organization.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export interface OrganizationSummaryRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  planName: string | null;
  activeMemberCount: number;
}

const DISPLAYABLE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE"] as const;

/**
 * Same list as listOrganizationsSearch, plus each row's current plan name and
 * active member count — for the Super Admin organizations page's row-list
 * view. One batched query via Prisma `include`/`_count` (same escape-hatch
 * cross-org read as listOrganizationBillingSummaries), not N+1 per row.
 */
export async function listOrganizationsWithSummarySearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<OrganizationSummaryRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = ORGANIZATION_SORT_FIELDS.includes(params.sortBy as (typeof ORGANIZATION_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof ORGANIZATION_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    ...(params.status ? { status: params.status as OrganizationStatus } : {}),
    ...(params.plan
      ? {
          subscriptions: {
            some: {
              status: { in: [...DISPLAYABLE_SUBSCRIPTION_STATUSES] },
              plan: { key: params.plan },
            },
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { slug: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [organizations, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.organization.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
      include: {
        subscriptions: {
          where: { status: { in: [...DISPLAYABLE_SUBSCRIPTION_STATUSES] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    }),
    prismaWithoutTenantScoping.organization.count({ where }),
  ]);

  const items: OrganizationSummaryRow[] = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    createdAt: org.createdAt,
    planName: org.subscriptions[0]?.plan.name ?? null,
    activeMemberCount: org._count.memberships,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function suspendOrganization(
  organizationId: string,
  context?: LifecycleActionContext,
): Promise<Organization> {
  const organization = await transitionOrganization({
    organizationId,
    action: "suspend",
    allowedFromStatuses: ["ACTIVE"],
    data: { status: "SUSPENDED" },
  });
  await auditAndEmit(organizationId, "organization.suspended", context);
  return organization;
}

export async function reactivateOrganization(
  organizationId: string,
  context?: LifecycleActionContext,
): Promise<Organization> {
  const organization = await transitionOrganization({
    organizationId,
    action: "reactivate",
    allowedFromStatuses: ["SUSPENDED"],
    data: { status: "ACTIVE" },
  });
  await auditAndEmit(organizationId, "organization.reactivated", context);
  return organization;
}

export async function archiveOrganization(
  organizationId: string,
  context?: LifecycleActionContext,
): Promise<Organization> {
  const organization = await transitionOrganization({
    organizationId,
    action: "archive",
    allowedFromStatuses: ["ACTIVE", "SUSPENDED"],
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await auditAndEmit(organizationId, "organization.archived", context);
  return organization;
}

export async function scheduleOrganizationDeletion(
  organizationId: string,
  options: { gracePeriodDays?: number } & LifecycleActionContext = {},
): Promise<Organization> {
  const gracePeriodDays = options.gracePeriodDays ?? 30;
  const deletionScheduledFor = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000);
  const organization = await transitionOrganization({
    organizationId,
    action: "schedule deletion for",
    allowedFromStatuses: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
    data: { status: "PENDING_DELETION", deletionScheduledFor },
  });
  await auditAndEmit(organizationId, "organization.deletion_scheduled", options, {
    deletionScheduledFor: deletionScheduledFor.toISOString(),
  });
  return organization;
}

export async function cancelScheduledDeletion(
  organizationId: string,
  context?: LifecycleActionContext,
): Promise<Organization> {
  const organization = await transitionOrganization({
    organizationId,
    action: "cancel scheduled deletion for",
    allowedFromStatuses: ["PENDING_DELETION"],
    data: { status: "ACTIVE", deletionScheduledFor: null },
  });
  await auditAndEmit(organizationId, "organization.deletion_cancelled", context);
  return organization;
}

export interface OrganizationExport {
  organization: Organization;
  roles: unknown[];
  memberships: unknown[];
  exportedAt: string;
}

/**
 * FR-132's "export": a snapshot of everything Phase 1A actually models for this
 * org. Grows as more tenant-scoped models are added — this is not a claim of
 * GDPR-complete data portability yet, just a real, working starting point.
 */
export async function exportOrganizationData(organizationId: string): Promise<OrganizationExport> {
  const organization = await prismaWithoutTenantScoping.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) throw new OrganizationNotFoundError(organizationId);

  const { roles, memberships } = await runWithTenant(organizationId, async () => {
    const [roles, memberships] = await Promise.all([
      db.role.findMany(),
      db.organizationMembership.findMany(),
    ]);
    return { roles, memberships };
  });

  return { organization, roles, memberships, exportedAt: new Date().toISOString() };
}

/**
 * Hard-deletes every organization whose grace period has elapsed. Cascades to
 * Team/Workspace/Role/etc. via their existing onDelete: Cascade FKs; AuditLog
 * survives (no FK) so the organization.deleted entry — written before the
 * delete — remains as the historical record.
 *
 * Not wired to a scheduler yet (Phase 1A has no scheduled-jobs infra); call
 * this from whatever cron/queue mechanism lands later.
 */
export async function executeDueOrganizationDeletions(now: Date = new Date()): Promise<string[]> {
  const due = await prismaWithoutTenantScoping.organization.findMany({
    where: { status: "PENDING_DELETION", deletionScheduledFor: { lte: now } },
  });

  const deletedIds: string[] = [];
  for (const organization of due) {
    await auditAndEmit(organization.id, "organization.deleted", undefined);
    await prismaWithoutTenantScoping.organization.delete({ where: { id: organization.id } });
    deletedIds.push(organization.id);
  }
  return deletedIds;
}
