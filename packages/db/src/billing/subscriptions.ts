import type { Prisma, Subscription, SubscriptionStatus } from "../../generated/client";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { writeAuditLog } from "../audit-log";
import type { ResourceOveragePolicy } from "../../generated/client";
import { getAddOn, getCurrentPlan, getPlanById } from "./plans";
import { getResourceUsage, recordResourceUsageWithQuota, type RecordUsageInput } from "./resource-consumption";
import { listResourceTypes } from "./resource-types";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "../list-query";

// FR-160–163: subscriptions are generic (not tied to a payment provider) and
// belong to exactly one organization — see the doc comment on the
// Subscription model (schema.prisma). This mirrors organization-lifecycle.ts's
// shape closely: an atomic compare-and-set transition helper, event logging
// alongside an audit trail, everything scoped through runWithTenant since
// Subscription (unlike Organization) IS a tenant-scoped model.

export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`No subscription with id ${subscriptionId}.`);
    this.name = "SubscriptionNotFoundError";
  }
}

export class PlanNotFoundError extends Error {
  constructor(planKey: string) {
    super(`No current plan with key "${planKey}".`);
    this.name = "PlanNotFoundError";
  }
}

export class AddOnNotFoundError extends Error {
  constructor(addOnKey: string) {
    super(`No add-on with key "${addOnKey}".`);
    this.name = "AddOnNotFoundError";
  }
}

export class InvalidSubscriptionTransitionError extends Error {
  constructor(action: string, currentStatus: string, allowedStatuses: readonly string[]) {
    super(
      `Cannot ${action} a subscription with status ${currentStatus} ` +
        `(requires one of: ${allowedStatuses.join(", ")}).`,
    );
    this.name = "InvalidSubscriptionTransitionError";
  }
}

export interface LifecycleActionContext {
  actorUserId?: string | null;
  reason?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function periodLengthMs(billingCycle: string | null): number {
  return billingCycle === "YEARLY" ? 365 * MS_PER_DAY : 30 * MS_PER_DAY;
}

async function requireSubscription(organizationId: string, subscriptionId: string): Promise<Subscription> {
  const subscription = await runWithTenant(organizationId, async () =>
    db.subscription.findUnique({ where: { id: subscriptionId } }),
  );
  if (!subscription) throw new SubscriptionNotFoundError(subscriptionId);
  return subscription;
}

async function transitionSubscription(params: {
  organizationId: string;
  subscriptionId: string;
  action: string;
  allowedFromStatuses: readonly SubscriptionStatus[];
  data: Prisma.SubscriptionUpdateInput;
}): Promise<Subscription> {
  return runWithTenant(params.organizationId, async () => {
    const { count } = await db.subscription.updateMany({
      where: { id: params.subscriptionId, status: { in: [...params.allowedFromStatuses] } },
      data: params.data,
    });
    if (count === 0) {
      const subscription = await db.subscription.findUnique({ where: { id: params.subscriptionId } });
      if (!subscription) throw new SubscriptionNotFoundError(params.subscriptionId);
      throw new InvalidSubscriptionTransitionError(params.action, subscription.status, params.allowedFromStatuses);
    }
    return db.subscription.findUniqueOrThrow({ where: { id: params.subscriptionId } });
  });
}

async function logSubscriptionEvent(
  organizationId: string,
  subscriptionId: string,
  type: string,
  context: LifecycleActionContext | undefined,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await runWithTenant(organizationId, async () => {
    await db.subscriptionEvent.create({
      data: {
        // organizationId required by the column, overwritten by the scoping extension.
        organizationId,
        subscriptionId,
        type,
        actorUserId: context?.actorUserId,
        fromPlanId: typeof extra.fromPlanId === "string" ? extra.fromPlanId : undefined,
        toPlanId: typeof extra.toPlanId === "string" ? extra.toPlanId : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (context?.reason ? { reason: context.reason, ...extra } : extra) as any,
      },
    });
    await writeAuditLog({
      module: "core",
      action: `subscription.${type}`,
      actorUserId: context?.actorUserId,
      resourceType: "Subscription",
      resourceId: subscriptionId,
      metadata: context?.reason ? { reason: context.reason } : undefined,
    });
  });
}

export interface CreateSubscriptionInput {
  organizationId: string;
  planKey: string;
  trialDays?: number;
}

export async function createSubscription(
  input: CreateSubscriptionInput,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const plan = await getCurrentPlan(input.planKey);
  if (!plan) throw new PlanNotFoundError(input.planKey);

  const now = new Date();
  const trialDays = input.trialDays ?? plan.trialDays ?? 0;
  const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * MS_PER_DAY) : null;
  const currentPeriodEnd = trialEndsAt ?? new Date(now.getTime() + periodLengthMs(plan.billingCycle));

  const subscription = await runWithTenant(input.organizationId, async () =>
    db.subscription.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        status: trialEndsAt ? "TRIALING" : "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEndsAt,
      },
    }),
  );

  await logSubscriptionEvent(input.organizationId, subscription.id, "created", context, { toPlanId: plan.id });
  return subscription;
}

export async function renewSubscription(
  organizationId: string,
  subscriptionId: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const current = await requireSubscription(organizationId, subscriptionId);
  const plan = await getPlanById(current.planId);
  const newPeriodEnd = new Date(current.currentPeriodEnd.getTime() + periodLengthMs(plan?.billingCycle ?? null));

  const updated = await transitionSubscription({
    organizationId,
    subscriptionId,
    action: "renew",
    allowedFromStatuses: ["ACTIVE", "TRIALING", "PAST_DUE"],
    data: { status: "ACTIVE", currentPeriodStart: current.currentPeriodEnd, currentPeriodEnd: newPeriodEnd },
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "renewed", context);
  return updated;
}

export async function extendSubscription(
  organizationId: string,
  subscriptionId: string,
  extendByDays: number,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const current = await requireSubscription(organizationId, subscriptionId);
  const newPeriodEnd = new Date(current.currentPeriodEnd.getTime() + extendByDays * MS_PER_DAY);
  const updated = await runWithTenant(organizationId, async () =>
    db.subscription.update({ where: { id: subscriptionId }, data: { currentPeriodEnd: newPeriodEnd } }),
  );
  await logSubscriptionEvent(organizationId, subscriptionId, "extended", context, { extendByDays });
  return updated;
}

export async function pauseSubscription(
  organizationId: string,
  subscriptionId: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const updated = await transitionSubscription({
    organizationId,
    subscriptionId,
    action: "pause",
    allowedFromStatuses: ["ACTIVE", "TRIALING"],
    data: { status: "PAUSED", pausedAt: new Date() },
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "paused", context);
  return updated;
}

export async function resumeSubscription(
  organizationId: string,
  subscriptionId: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const updated = await transitionSubscription({
    organizationId,
    subscriptionId,
    action: "resume",
    allowedFromStatuses: ["PAUSED"],
    data: { status: "ACTIVE", pausedAt: null },
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "resumed", context);
  return updated;
}

export async function terminateSubscription(
  organizationId: string,
  subscriptionId: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const updated = await transitionSubscription({
    organizationId,
    subscriptionId,
    action: "terminate",
    allowedFromStatuses: ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE", "CANCELED"],
    data: { status: "TERMINATED", terminatedAt: new Date() },
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "terminated", context);
  return updated;
}

/**
 * Immediate: flips to CANCELED right away. Scheduled (default): only marks
 * cancelAt/canceledAt — status stays whatever it was until
 * executeDueCancellations actually finalizes it, same "no scheduler wired up
 * yet" gap as organization-lifecycle.ts's executeDueOrganizationDeletions.
 */
export async function cancelSubscription(
  organizationId: string,
  subscriptionId: string,
  options: { immediate?: boolean } & LifecycleActionContext = {},
): Promise<Subscription> {
  const current = await requireSubscription(organizationId, subscriptionId);
  const allowedFromStatuses = ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE"] as const;
  if (!allowedFromStatuses.includes(current.status as (typeof allowedFromStatuses)[number])) {
    throw new InvalidSubscriptionTransitionError("cancel", current.status, allowedFromStatuses);
  }

  const now = new Date();
  const updated = await runWithTenant(organizationId, async () =>
    db.subscription.update({
      where: { id: subscriptionId },
      data: options.immediate
        ? { status: "CANCELED", canceledAt: now, cancelAt: now }
        : { canceledAt: now, cancelAt: current.currentPeriodEnd },
    }),
  );
  await logSubscriptionEvent(organizationId, subscriptionId, "canceled", options, {
    immediate: options.immediate ?? false,
  });
  return updated;
}

async function changeSubscriptionPlan(
  organizationId: string,
  subscriptionId: string,
  newPlanKey: string,
  eventType: "upgraded" | "downgraded",
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const current = await requireSubscription(organizationId, subscriptionId);
  const newPlan = await getCurrentPlan(newPlanKey);
  if (!newPlan) throw new PlanNotFoundError(newPlanKey);

  const updated = await runWithTenant(organizationId, async () =>
    db.subscription.update({ where: { id: subscriptionId }, data: { planId: newPlan.id } }),
  );
  await logSubscriptionEvent(organizationId, subscriptionId, eventType, context, {
    fromPlanId: current.planId,
    toPlanId: newPlan.id,
  });
  return updated;
}

/**
 * Super Admin's "Assign plan" — creates a subscription if the org has none,
 * otherwise swaps the existing one's plan directly (no upgrade/downgrade
 * direction semantics; this is an operator override, not a self-service
 * change). Deliberately its own event type ("plan_assigned") rather than
 * reusing changeSubscriptionPlan's upgraded/downgraded pair.
 */
export async function assignSubscriptionPlan(
  organizationId: string,
  planKey: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  const existing = await getActiveSubscription(organizationId);
  if (!existing) {
    return createSubscription({ organizationId, planKey }, context);
  }

  const newPlan = await getCurrentPlan(planKey);
  if (!newPlan) throw new PlanNotFoundError(planKey);

  // An operator override puts the org on a clean footing: not just the plan,
  // but a healthy status and a fresh period — otherwise assigning a plan to a
  // PAST_DUE / PAUSED subscription would leave it non-active and quota
  // resolution would still treat it as broken.
  const now = new Date();
  const updated = await runWithTenant(organizationId, async () =>
    db.subscription.update({
      where: { id: existing.id },
      data: {
        planId: newPlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + periodLengthMs(newPlan.billingCycle)),
        trialEndsAt: null,
      },
    }),
  );
  await logSubscriptionEvent(organizationId, existing.id, "plan_assigned", context, {
    fromPlanId: existing.planId,
    toPlanId: newPlan.id,
  });
  return updated;
}

export async function upgradeSubscription(
  organizationId: string,
  subscriptionId: string,
  newPlanKey: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  return changeSubscriptionPlan(organizationId, subscriptionId, newPlanKey, "upgraded", context);
}

export async function downgradeSubscription(
  organizationId: string,
  subscriptionId: string,
  newPlanKey: string,
  context?: LifecycleActionContext,
): Promise<Subscription> {
  return changeSubscriptionPlan(organizationId, subscriptionId, newPlanKey, "downgraded", context);
}

export interface ManualAdjustmentInput {
  currentPeriodEnd?: Date;
  status?: SubscriptionStatus;
  metadata?: unknown;
}

/** FR-162's "manually adjust" — an explicit admin override, always requires a reason (unlike every other action here, where context is optional). */
export async function manuallyAdjustSubscription(
  organizationId: string,
  subscriptionId: string,
  adjustments: ManualAdjustmentInput,
  context: LifecycleActionContext & { reason: string },
): Promise<Subscription> {
  const updated = await runWithTenant(organizationId, async () =>
    db.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodEnd: adjustments.currentPeriodEnd,
        status: adjustments.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: adjustments.metadata as any,
      },
    }),
  );
  await logSubscriptionEvent(organizationId, subscriptionId, "manually_adjusted", context, { adjustments });
  return updated;
}

/** Hard-finalizes subscriptions whose scheduled cancellation date has passed. Not wired to a scheduler — same gap as executeDueOrganizationDeletions. */
export async function executeDueCancellations(now: Date = new Date()): Promise<string[]> {
  const due = await prismaWithoutTenantScoping.subscription.findMany({
    where: { cancelAt: { lte: now }, status: { in: ["ACTIVE", "TRIALING", "PAUSED"] } },
  });

  const canceledIds: string[] = [];
  for (const subscription of due) {
    await runWithTenant(subscription.organizationId, async () => {
      await db.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELED" } });
    });
    await logSubscriptionEvent(subscription.organizationId, subscription.id, "cancellation_finalized", undefined);
    canceledIds.push(subscription.id);
  }
  return canceledIds;
}

// --- Add-ons (FR-183: attaching a catalog add-on to a subscription) ---

export async function attachAddOn(
  organizationId: string,
  subscriptionId: string,
  addOnKey: string,
  quantity = 1,
  context?: LifecycleActionContext,
): Promise<void> {
  const addOn = await getAddOn(addOnKey);
  if (!addOn) throw new AddOnNotFoundError(addOnKey);

  await runWithTenant(organizationId, async () => {
    await db.subscriptionAddOn.upsert({
      where: { subscriptionId_addOnId: { subscriptionId, addOnId: addOn.id } },
      create: { organizationId, subscriptionId, addOnId: addOn.id, quantity },
      update: { quantity },
    });
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "add_on_attached", context, { addOnKey, quantity });
}

export async function detachAddOn(
  organizationId: string,
  subscriptionId: string,
  addOnKey: string,
  context?: LifecycleActionContext,
): Promise<void> {
  const addOn = await getAddOn(addOnKey);
  if (!addOn) throw new AddOnNotFoundError(addOnKey);

  await runWithTenant(organizationId, async () => {
    await db.subscriptionAddOn.deleteMany({ where: { subscriptionId, addOnId: addOn.id } });
  });
  await logSubscriptionEvent(organizationId, subscriptionId, "add_on_detached", context, { addOnKey });
}

// --- Closing the resource-consumption.ts quota-lookup gap (FR-173 + FR-161's "resource allocation") ---

/**
 * The org's current subscription for display purposes — broader status set
 * than getOrganizationResourceQuota's (includes PAUSED/PAST_DUE) since a
 * billing page needs to show "your subscription is paused", not just silently
 * treat it as if there were no subscription at all.
 */
export async function getActiveSubscription(organizationId: string): Promise<Subscription | null> {
  return runWithTenant(organizationId, async () =>
    db.subscription.findFirst({
      where: { status: { in: ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export interface SubscriptionHistoryRow {
  id: string;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
}

const SUBSCRIPTION_HISTORY_SORT_FIELDS = ["createdAt", "currentPeriodEnd", "planName"] as const;

/** Every subscription an org has ever had (not just the current one) — the Subscriptions tab's row-list, read-only history rather than a single "current plan" line. */
export async function listSubscriptionsForOrganizationSearch(
  organizationId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<SubscriptionHistoryRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = SUBSCRIPTION_HISTORY_SORT_FIELDS.includes(
    params.sortBy as (typeof SUBSCRIPTION_HISTORY_SORT_FIELDS)[number],
  )
    ? (params.sortBy as (typeof SUBSCRIPTION_HISTORY_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "desc";
  const where: Prisma.SubscriptionWhereInput = {
    AND: [
      params.q
        ? { plan: { name: { contains: params.q, mode: "insensitive" as const } } }
        : {},
      params.status ? { status: params.status as SubscriptionStatus } : {},
    ],
  };
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput[] =
    sortBy === "planName"
      ? [{ plan: { name: sortDir } }, { createdAt: "desc" }]
      : [{ [sortBy]: sortDir }, { createdAt: "desc" }];

  const [subscriptions, totalCount] = await runWithTenant(organizationId, async () =>
    Promise.all([
      db.subscription.findMany({
        where,
        orderBy,
        ...toSkipTake(page, pageSize),
        include: { plan: true },
      }),
      db.subscription.count({ where }),
    ]),
  );

  const items: SubscriptionHistoryRow[] = subscriptions.map((subscription) => ({
    id: subscription.id,
    planName: subscription.plan.name,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    canceledAt: subscription.canceledAt,
    terminatedAt: subscription.terminatedAt,
    createdAt: subscription.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

/**
 * Resolves an org's actual quota for a resource type from its active
 * subscription's plan. Returns null (unlimited) if there's no active
 * subscription, or the plan doesn't allocate that resource type at all.
 */
export async function getOrganizationResourceQuota(
  organizationId: string,
  resourceTypeKey: string,
): Promise<number | null> {
  const subscription = await runWithTenant(organizationId, async () =>
    db.subscription.findFirst({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (!subscription) return null;

  const plan = await getPlanById(subscription.planId);
  const allocation = plan?.resources.find((r) => r.resourceTypeKey === resourceTypeKey);
  return allocation?.limit ?? null;
}

/** recordResourceUsageWithQuota (resource-consumption.ts), but the quota comes from the org's actual subscription instead of being passed in by the caller. */
export async function recordResourceUsageEnforced(input: RecordUsageInput): Promise<void> {
  const quotaLimit = await getOrganizationResourceQuota(input.organizationId, input.resourceTypeKey);
  await recordResourceUsageWithQuota(input, quotaLimit);
}

export interface ResourceUsageSummary {
  resourceTypeKey: string;
  unit: string;
  used: number;
  /** null = unlimited (no active subscription, or its plan doesn't allocate this resource type at all) — same convention as getOrganizationResourceQuota. */
  limit: number | null;
  overagePolicy: ResourceOveragePolicy;
}

/**
 * Every registered resource type's current usage/limit for an org, in one
 * call — what an API client needs to show its own quota UI without making
 * one request per resource type. Composes listResourceTypes (the catalog),
 * getResourceUsage (per-type consumption), and getOrganizationResourceQuota
 * (per-type limit) — no new storage, just a combined read.
 */
export async function getResourceUsageSummary(organizationId: string): Promise<ResourceUsageSummary[]> {
  const resourceTypes = await listResourceTypes();
  return Promise.all(
    resourceTypes.map(async (resourceType) => {
      const [used, limit] = await Promise.all([
        getResourceUsage(organizationId, resourceType.key),
        getOrganizationResourceQuota(organizationId, resourceType.key),
      ]);
      return { resourceTypeKey: resourceType.key, unit: resourceType.unit, used, limit, overagePolicy: resourceType.overagePolicy };
    }),
  );
}
