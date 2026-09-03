import { prismaWithoutTenantScoping } from "./client";

// FR-111's Super Admin dashboard — a cross-organization, view-only surface,
// same reasoning as super-admin-billing.ts: reads go through
// prismaWithoutTenantScoping deliberately, since a platform operator
// legitimately needs to see across every org at once.

const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE"] as const;

export interface GrowthPoint {
  date: string; // YYYY-MM-DD
  totalOrganizations: number;
}

/** Cumulative organization count per day over the trailing `days` days (a "growth" chart, not a per-day delta). All date math is done in UTC — mixing local-time bucketing with toISOString() (UTC) day strings would drift the boundary by the local UTC offset. */
/** Total organization rows — platform-wide count for the super-admin stat tiles. */
export async function countOrganizations(): Promise<number> {
  return prismaWithoutTenantScoping.organization.count();
}

/** Count of subscriptions in an active/paying state — platform-wide, for the super-admin stat tiles. Restricted to subscriptions against `isCurrent` plans so the tile can never exceed what the plan-distribution card and Manage Plans together show. */
export async function countActiveSubscriptions(): Promise<number> {
  return prismaWithoutTenantScoping.subscription.count({
    where: { status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] }, plan: { isCurrent: true } },
  });
}

/** Count of active (non-invited, non-suspended, non-removed) memberships across every org — platform-wide, for the super-admin stat tiles. */
export async function countActiveMembers(): Promise<number> {
  return prismaWithoutTenantScoping.organizationMembership.count({ where: { status: "ACTIVE" } });
}

export async function getOrganizationGrowth(days = 30): Promise<GrowthPoint[]> {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const since = new Date(todayUtc - days * 24 * 60 * 60 * 1000);

  const [baselineCount, createdSince] = await Promise.all([
    prismaWithoutTenantScoping.organization.count({ where: { createdAt: { lt: since } } }),
    prismaWithoutTenantScoping.organization.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const { createdAt } of createdSince) {
    const day = createdAt.toISOString().slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }

  const points: GrowthPoint[] = [];
  let running = baselineCount;
  for (let i = 0; i <= days; i++) {
    const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    running += countsByDay.get(day) ?? 0;
    points.push({ date: day, totalOrganizations: running });
  }
  return points;
}

export interface PlanDistributionEntry {
  planName: string;
  activeSubscriptions: number;
}

/** Active-subscription count grouped by plan, sorted descending — feeds a ranked list, not a pie chart (see dataviz skill notes: a small named-category magnitude comparison reads better as ranked bars). Only counts subscriptions against `isCurrent` plans: a superseded plan version is hidden from the Manage Plans list, so counting its subscribers here would surface plans that don't exist anywhere in the platform. */
export async function getPlanDistribution(): Promise<PlanDistributionEntry[]> {
  const subscriptions = await prismaWithoutTenantScoping.subscription.findMany({
    where: {
      status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      plan: { isCurrent: true },
    },
    include: { plan: { select: { name: true } } },
  });
  const counts = new Map<string, number>();
  for (const sub of subscriptions) {
    counts.set(sub.plan.name, (counts.get(sub.plan.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([planName, activeSubscriptions]) => ({ planName, activeSubscriptions }))
    .sort((a, b) => b.activeSubscriptions - a.activeSubscriptions);
}

export interface RecentSubscriptionRow {
  id: string;
  organizationId: string;
  organizationName: string;
  memberCount: number;
  planName: string;
  status: string;
  createdAt: Date;
}

export async function listRecentSubscriptions(limit = 8): Promise<RecentSubscriptionRow[]> {
  const subscriptions = await prismaWithoutTenantScoping.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { plan: { select: { name: true } } },
  });
  const orgIds = [...new Set(subscriptions.map((s) => s.organizationId))];
  const orgs = await prismaWithoutTenantScoping.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      name: true,
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  return subscriptions.map((sub) => {
    const org = orgById.get(sub.organizationId);
    return {
      id: sub.id,
      organizationId: sub.organizationId,
      organizationName: org?.name ?? "Unknown",
      memberCount: org?._count.memberships ?? 0,
      planName: sub.plan.name,
      status: sub.status,
      createdAt: sub.createdAt,
    };
  });
}

export interface RecentCustomerRow {
  id: string;
  name: string;
  memberCount: number;
  status: string;
  createdAt: Date;
}

export async function listRecentCustomers(limit = 8): Promise<RecentCustomerRow[]> {
  const organizations = await prismaWithoutTenantScoping.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });
  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    memberCount: org._count.memberships,
    status: org.status,
    createdAt: org.createdAt,
  }));
}

export interface RecentActivityRow {
  id: string;
  organizationName: string;
  actorEmail: string | null;
  action: string;
  createdAt: Date;
}

/** Platform-wide activity feed — unlike listRecentAuditLogs (audit-log.ts), which is deliberately tenant-scoped, this reads across every org for the Super Admin dashboard. */
export async function listRecentActivity(limit = 10): Promise<RecentActivityRow[]> {
  const entries = await prismaWithoutTenantScoping.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const orgIds = [...new Set(entries.map((e) => e.organizationId))];
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => id !== null))];
  const [orgs, actors] = await Promise.all([
    prismaWithoutTenantScoping.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
    prismaWithoutTenantScoping.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }),
  ]);
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  return entries.map((entry) => ({
    id: entry.id,
    organizationName: orgNameById.get(entry.organizationId) ?? "Unknown",
    actorEmail: entry.actorUserId ? (actorEmailById.get(entry.actorUserId) ?? null) : null,
    action: entry.action,
    createdAt: entry.createdAt,
  }));
}
