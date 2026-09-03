import type { Feature } from "../../generated/client";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { redis } from "../redis-client";

// FR-190–192: features are enabled globally, per plan, per organization, or
// per user, with that precedence (most specific wins — user > org > plan >
// global default). FR-191's registration is the same idempotent-upsert
// pattern as Permission/ResourceType. FR-192's caching: each precedence
// level is cached under its own key (not one combined key per
// feature+org+user pair) so a single override write invalidates exactly the
// keys it affects, and unrelated org/user combinations still hit a warm
// cache for the levels that didn't change.

const CACHE_TTL_SECONDS = 300;
const PLAN_CACHE_TTL_SECONDS = 3600; // plan rows are immutable once created (FR-182) — safe to cache longer

type TriState = "true" | "false" | "none";

function encode(value: boolean | null): TriState {
  return value === null ? "none" : value ? "true" : "false";
}
function decode(value: TriState): boolean | null {
  return value === "none" ? null : value === "true";
}

async function cacheGet(key: string): Promise<boolean | null | undefined> {
  const value = await redis.get(key);
  return value === null ? undefined : decode(value as TriState);
}
async function cacheSet(key: string, value: boolean | null, ttlSeconds: number): Promise<void> {
  await redis.set(key, encode(value), "EX", ttlSeconds);
}
async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export interface FeatureDefinition {
  key: string;
  module: string;
  name: string;
  description?: string;
  defaultEnabled?: boolean;
}

export class FeatureKeyConflictError extends Error {
  constructor(key: string, existingModule: string, incomingModule: string) {
    super(
      `Feature key "${key}" is already registered by module "${existingModule}" — ` +
        `module "${incomingModule}" cannot claim it. Namespace yours (e.g. "yourModule.thing") to avoid collisions.`,
    );
    this.name = "FeatureKeyConflictError";
  }
}

export class UnknownFeatureError extends Error {
  constructor(key: string) {
    super(`No feature registered with key "${key}". Register it first (registerFeatures).`);
    this.name = "UnknownFeatureError";
  }
}

/** Idempotent: safe to call on every boot/deploy, not just once — same contract as registerPermissions/registerResourceTypes. */
export async function registerFeatures(definitions: FeatureDefinition[]): Promise<void> {
  for (const definition of definitions) {
    const existing = await prismaWithoutTenantScoping.feature.findUnique({ where: { key: definition.key } });
    if (existing && existing.module !== definition.module) {
      throw new FeatureKeyConflictError(definition.key, existing.module, definition.module);
    }

    await prismaWithoutTenantScoping.feature.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        module: definition.module,
        name: definition.name,
        description: definition.description,
        defaultEnabled: definition.defaultEnabled ?? false,
      },
      update: {
        module: definition.module,
        name: definition.name,
        description: definition.description,
        defaultEnabled: definition.defaultEnabled ?? false,
      },
    });
  }
}

export async function getFeature(key: string): Promise<Feature | null> {
  return prismaWithoutTenantScoping.feature.findUnique({ where: { key } });
}

export async function listFeatures(): Promise<Feature[]> {
  return prismaWithoutTenantScoping.feature.findMany({ orderBy: { key: "asc" } });
}

async function resolveUserOverride(userId: string, feature: Feature): Promise<boolean | null> {
  const cacheKey = `ff:user:${userId}:${feature.key}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const override = await prismaWithoutTenantScoping.userFeatureOverride.findUnique({
    where: { userId_featureId: { userId, featureId: feature.id } },
  });
  const result = override ? override.enabled : null;
  await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}

async function resolveOrganizationOverride(organizationId: string, feature: Feature): Promise<boolean | null> {
  const cacheKey = `ff:org:${organizationId}:${feature.key}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const override = await runWithTenant(organizationId, async () =>
    db.organizationFeatureOverride.findUnique({
      where: { organizationId_featureId: { organizationId, featureId: feature.id } },
    }),
  );
  const result = override ? override.enabled : null;
  await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}

async function resolvePlanFeature(organizationId: string, feature: Feature): Promise<boolean | null> {
  const subscription = await runWithTenant(organizationId, async () =>
    db.subscription.findFirst({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (!subscription) return null;

  const cacheKey = `ff:plan:${subscription.planId}:${feature.key}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const planFeature = await prismaWithoutTenantScoping.planFeature.findUnique({
    where: { planId_featureId: { planId: subscription.planId, featureId: feature.id } },
  });
  const result = planFeature ? planFeature.enabled : null;
  await cacheSet(cacheKey, result, PLAN_CACHE_TTL_SECONDS);
  return result;
}

export interface FeatureContext {
  featureKey: string;
  organizationId?: string;
  userId?: string;
}

/** FR-190's precedence: user override > organization override > plan grant > global default. */
export async function isFeatureEnabled(context: FeatureContext): Promise<boolean> {
  const feature = await getFeature(context.featureKey);
  if (!feature) throw new UnknownFeatureError(context.featureKey);

  if (context.userId) {
    const userResult = await resolveUserOverride(context.userId, feature);
    if (userResult !== null) return userResult;
  }

  if (context.organizationId) {
    const orgResult = await resolveOrganizationOverride(context.organizationId, feature);
    if (orgResult !== null) return orgResult;

    const planResult = await resolvePlanFeature(context.organizationId, feature);
    if (planResult !== null) return planResult;
  }

  return feature.defaultEnabled;
}

/** FR-192's "available to ... frontend": the resolved set of enabled feature keys for a bootstrap payload. */
export async function getEnabledFeaturesForContext(
  context: Omit<FeatureContext, "featureKey">,
): Promise<string[]> {
  const allFeatures = await listFeatures();
  const enabled = await Promise.all(
    allFeatures.map(async (feature) => ({
      key: feature.key,
      enabled: await isFeatureEnabled({ featureKey: feature.key, ...context }),
    })),
  );
  return enabled.filter((f) => f.enabled).map((f) => f.key);
}

export async function setOrganizationFeatureOverride(
  organizationId: string,
  featureKey: string,
  enabled: boolean,
): Promise<void> {
  const feature = await getFeature(featureKey);
  if (!feature) throw new UnknownFeatureError(featureKey);

  await runWithTenant(organizationId, async () => {
    await db.organizationFeatureOverride.upsert({
      where: { organizationId_featureId: { organizationId, featureId: feature.id } },
      create: { organizationId, featureId: feature.id, enabled },
      update: { enabled },
    });
  });
  await cacheDel(`ff:org:${organizationId}:${featureKey}`);
}

export async function clearOrganizationFeatureOverride(organizationId: string, featureKey: string): Promise<void> {
  const feature = await getFeature(featureKey);
  if (!feature) throw new UnknownFeatureError(featureKey);

  await runWithTenant(organizationId, async () => {
    await db.organizationFeatureOverride.deleteMany({ where: { featureId: feature.id } });
  });
  await cacheDel(`ff:org:${organizationId}:${featureKey}`);
}

export async function setUserFeatureOverride(userId: string, featureKey: string, enabled: boolean): Promise<void> {
  const feature = await getFeature(featureKey);
  if (!feature) throw new UnknownFeatureError(featureKey);

  await prismaWithoutTenantScoping.userFeatureOverride.upsert({
    where: { userId_featureId: { userId, featureId: feature.id } },
    create: { userId, featureId: feature.id, enabled },
    update: { enabled },
  });
  await cacheDel(`ff:user:${userId}:${featureKey}`);
}

export async function clearUserFeatureOverride(userId: string, featureKey: string): Promise<void> {
  const feature = await getFeature(featureKey);
  if (!feature) throw new UnknownFeatureError(featureKey);

  await prismaWithoutTenantScoping.userFeatureOverride.deleteMany({
    where: { userId, featureId: feature.id },
  });
  await cacheDel(`ff:user:${userId}:${featureKey}`);
}
