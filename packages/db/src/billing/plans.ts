import type { BillingCycle, Plan, PlanType, PlanVisibility, Prisma } from "../../generated/client";
import { prismaWithoutTenantScoping } from "../client";
import { UnknownFeatureError } from "./features";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "../list-query";

// FR-180–183: Plans are global (platform-defined), versioned. See the doc
// comment on the Plan model (schema.prisma) for why versioning is enforced
// here at the service layer rather than via a blanket immutability mechanism:
// price/terms fields never change post-creation, but `isCurrent` (and
// `visibility`, an operational toggle — hiding/archiving a plan isn't the
// same event as repricing it) legitimately do. This module is the only
// place those fields get written; there is no general-purpose "updatePlan".

export interface PlanResourceAllocation {
  resourceTypeKey: string;
  limit: number | null;
}

export interface PlanFeatureGrant {
  featureKey: string;
  enabled?: boolean;
}

/** Resolves feature keys to ids, throwing UnknownFeatureError on the first one that isn't registered. */
async function resolveFeatureIds(tx: Pick<typeof prismaWithoutTenantScoping, "feature">, keys: string[]) {
  const features = await tx.feature.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(features.map((f) => [f.key, f.id]));
  for (const key of keys) {
    if (!byKey.has(key)) throw new UnknownFeatureError(key);
  }
  return byKey;
}

export interface CreatePlanVersionInput {
  key: string;
  name: string;
  type: PlanType;
  description?: string;
  visibility?: PlanVisibility;
  priceCents?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  trialDays?: number;
  gracePeriodDays?: number;
  metadata?: unknown;
  resources?: PlanResourceAllocation[];
  features?: PlanFeatureGrant[];
  termsOfService?: string;
  termsOfServiceDisabled?: boolean;
}

/**
 * Creates a new version of `key`. If a current version already exists, it's
 * atomically flipped to isCurrent: false in the same transaction — existing
 * Subscriptions keep referencing their own Plan row (a specific id/version),
 * completely unaffected (FR-182); only *new* subscriptions see the new terms.
 */
export async function createPlanVersion(input: CreatePlanVersionInput) {
  return prismaWithoutTenantScoping.$transaction(async (tx) => {
    const previous = await tx.plan.findFirst({ where: { key: input.key, isCurrent: true } });
    const version = (previous?.version ?? 0) + 1;

    if (previous) {
      await tx.plan.update({ where: { id: previous.id }, data: { isCurrent: false } });
    }

    const featureIds = input.features
      ? await resolveFeatureIds(
          tx,
          input.features.map((f) => f.featureKey),
        )
      : undefined;

    return tx.plan.create({
      data: {
        key: input.key,
        version,
        isCurrent: true,
        name: input.name,
        type: input.type,
        description: input.description,
        visibility: input.visibility ?? "PUBLIC",
        priceCents: input.priceCents,
        currency: input.currency ?? "usd",
        billingCycle: input.billingCycle,
        trialDays: input.trialDays,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        termsOfService: input.termsOfService,
        termsOfServiceDisabled: input.termsOfServiceDisabled ?? true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: input.metadata as any,
        resources: input.resources ? { create: input.resources } : undefined,
        features:
          input.features && featureIds
            ? {
                create: input.features.map((f) => ({
                  featureId: featureIds.get(f.featureKey)!,
                  enabled: f.enabled ?? true,
                })),
              }
            : undefined,
      },
      include: { resources: true, features: true },
    });
  });
}

export async function getCurrentPlan(key: string) {
  return prismaWithoutTenantScoping.plan.findFirst({
    where: { key, isCurrent: true },
    include: { resources: true, features: true },
  });
}

export async function getPlanVersion(key: string, version: number) {
  return prismaWithoutTenantScoping.plan.findUnique({
    where: { key_version: { key, version } },
    include: { resources: true, features: true },
  });
}

export async function getPlanById(id: string) {
  return prismaWithoutTenantScoping.plan.findUnique({
    where: { id },
    include: { resources: true, features: true },
  });
}

export interface ListPlansOptions {
  visibility?: PlanVisibility[];
}

/** Lists current versions only — old versions exist purely for pinned Subscriptions to reference, never for browsing. */
export async function listPlans(options: ListPlansOptions = {}) {
  return prismaWithoutTenantScoping.plan.findMany({
    where: { isCurrent: true, ...(options.visibility ? { visibility: { in: options.visibility } } : {}) },
    include: { resources: true, features: true, _count: { select: { subscriptions: true } } },
    orderBy: { createdAt: "asc" },
  });
}

const PLAN_SORT_FIELDS = ["name", "price", "subscribers", "visibility", "createdAt"] as const;

const PLAN_TYPE_VALUES = [
  "FREE",
  "TRIAL",
  "MONTHLY",
  "YEARLY",
  "LIFETIME",
  "ENTERPRISE",
  "USAGE_BASED",
  "CUSTOM_PRICING",
  "INVITE_ONLY",
  "HIDDEN",
] as const;

const PLAN_VISIBILITY_VALUES = ["PUBLIC", "INVITE_ONLY", "HIDDEN", "ARCHIVED"] as const;

/** Searchable/sortable/paginated variant of listPlans for the Super Admin plans DataTable. */
export async function listPlansSearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<Plan & { subscriberCount: number }>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLAN_SORT_FIELDS.includes(params.sortBy as (typeof PLAN_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof PLAN_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "asc";
  const where: Prisma.PlanWhereInput = {
    isCurrent: true,
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
    ...(params.type && PLAN_TYPE_VALUES.includes(params.type as PlanType)
      ? { type: params.type as PlanType }
      : {}),
    ...(params.visibility && PLAN_VISIBILITY_VALUES.includes(params.visibility as PlanVisibility)
      ? { visibility: params.visibility as PlanVisibility }
      : {}),
  };
  const orderBy: Prisma.PlanOrderByWithRelationInput[] =
    sortBy === "price"
      ? [{ priceCents: sortDir }, { createdAt: "asc" }]
      : sortBy === "subscribers"
        ? [{ subscriptions: { _count: sortDir } }, { createdAt: "asc" }]
        : [{ [sortBy]: sortDir }, { createdAt: "asc" }];

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.plan.findMany({
      where,
      orderBy,
      ...toSkipTake(page, pageSize),
      include: { resources: true, features: true, _count: { select: { subscriptions: true } } },
    }),
    prismaWithoutTenantScoping.plan.count({ where }),
  ]);
  const items = rows.map((plan) => ({ ...plan, subscriberCount: plan._count.subscriptions }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

/** The one mutation allowed outside createPlanVersion — visibility is operational, not a repricing event. */
export async function setPlanVisibility(planId: string, visibility: PlanVisibility): Promise<Plan> {
  return prismaWithoutTenantScoping.plan.update({ where: { id: planId }, data: { visibility } });
}

// --- Add-ons (FR-183 catalog; attaching one to a Subscription is that model's job) ---

export interface AddOnResourceGrant {
  resourceTypeKey: string;
  grantAmount: number;
}

export interface CreateAddOnInput {
  key: string;
  name: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  resources?: AddOnResourceGrant[];
  features?: string[];
}

export async function createAddOn(input: CreateAddOnInput) {
  const featureIds = input.features ? await resolveFeatureIds(prismaWithoutTenantScoping, input.features) : undefined;

  return prismaWithoutTenantScoping.addOn.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      currency: input.currency ?? "usd",
      resources: input.resources ? { create: input.resources } : undefined,
      features:
        input.features && featureIds
          ? { create: input.features.map((key) => ({ featureId: featureIds.get(key)! })) }
          : undefined,
    },
    include: { resources: true, features: true },
  });
}

export async function listAddOns() {
  return prismaWithoutTenantScoping.addOn.findMany({
    include: { resources: true, features: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAddOn(key: string) {
  return prismaWithoutTenantScoping.addOn.findUnique({
    where: { key },
    include: { resources: true, features: true },
  });
}
