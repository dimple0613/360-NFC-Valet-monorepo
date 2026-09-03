import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { redis } from "../redis-client";
import {
  clearOrganizationFeatureOverride,
  clearUserFeatureOverride,
  FeatureKeyConflictError,
  getEnabledFeaturesForContext,
  getFeature,
  isFeatureEnabled,
  registerFeatures,
  setOrganizationFeatureOverride,
  setUserFeatureOverride,
  UnknownFeatureError,
} from "../billing/features";
import { createPlanVersion } from "../billing/plans";
import { createSubscription, terminateSubscription } from "../billing/subscriptions";

const runId = Date.now().toString(36);
const key = `test-feature-${runId}`;
const module = `test-module-${runId}`;
const planKey = `test-ff-plan-${runId}`;

describe("feature flags (FR-190–192)", () => {
  let org: { id: string };
  let user: { id: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "FF Org", slug: `ff-org-${runId}` },
    });
    user = await prismaWithoutTenantScoping.user.create({ data: { email: `ff-user-${runId}@example.com` } });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userFeatureOverride.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.organizationFeatureOverride.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.planFeature.deleteMany({ where: { plan: { key: planKey } } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: planKey } });
    await prismaWithoutTenantScoping.feature.deleteMany({ where: { key: { startsWith: `test-feature-${runId}` } } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
    redis.disconnect();
  });

  it("throws for an unregistered feature", async () => {
    await expect(isFeatureEnabled({ featureKey: "nonexistent.key" })).rejects.toThrow(UnknownFeatureError);
  });

  it("registerFeatures is idempotent and conflict-checked, same as the other registries", async () => {
    await registerFeatures([{ key, module, name: "Test Feature", defaultEnabled: false }]);
    await registerFeatures([{ key, module, name: "Test Feature Renamed", defaultEnabled: false }]);
    const feature = await getFeature(key);
    expect(feature?.name).toBe("Test Feature Renamed");

    await expect(
      registerFeatures([{ key, module: `other-${runId}`, name: "X" }]),
    ).rejects.toThrow(FeatureKeyConflictError);
  });

  it("falls back to the global default with no overrides and no subscription", async () => {
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id, userId: user.id })).resolves.toBe(
      false,
    );

    await registerFeatures([{ key, module, name: "Test Feature", defaultEnabled: true }]);
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id, userId: user.id })).resolves.toBe(
      true,
    );
  });

  it("plan-level grant overrides the global default", async () => {
    await createPlanVersion({ key: planKey, name: "FF Plan", type: "FREE", features: [{ featureKey: key, enabled: false }] });
    const sub = await createSubscription({ organizationId: org.id, planKey });

    // Global default is true (from previous test), but the plan explicitly disables it.
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id })).resolves.toBe(false);

    await terminateSubscription(org.id, sub.id);
  });

  it("organization override beats the plan grant", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey }); // plan says false
    await setOrganizationFeatureOverride(org.id, key, true);

    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id })).resolves.toBe(true);

    await clearOrganizationFeatureOverride(org.id, key);
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id })).resolves.toBe(false); // back to plan-level false

    await terminateSubscription(org.id, sub.id);
  });

  it("user override beats everything, including the organization override", async () => {
    await setOrganizationFeatureOverride(org.id, key, true);
    await setUserFeatureOverride(user.id, key, false);

    await expect(
      isFeatureEnabled({ featureKey: key, organizationId: org.id, userId: user.id }),
    ).resolves.toBe(false);

    await clearUserFeatureOverride(user.id, key);
    await expect(
      isFeatureEnabled({ featureKey: key, organizationId: org.id, userId: user.id }),
    ).resolves.toBe(true); // falls back to the still-active org override

    await clearOrganizationFeatureOverride(org.id, key);
  });

  it("cache invalidation: a changed override is reflected immediately, not after a stale TTL", async () => {
    await setOrganizationFeatureOverride(org.id, key, true);
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id })).resolves.toBe(true); // warms the cache

    await setOrganizationFeatureOverride(org.id, key, false);
    await expect(isFeatureEnabled({ featureKey: key, organizationId: org.id })).resolves.toBe(false); // must not serve the stale cached "true"

    await clearOrganizationFeatureOverride(org.id, key);
  });

  it("getEnabledFeaturesForContext returns exactly the resolved-enabled set", async () => {
    const otherKey = `${key}.other`;
    await registerFeatures([{ key: otherKey, module, name: "Other", defaultEnabled: false }]);

    const enabled = await getEnabledFeaturesForContext({ organizationId: org.id, userId: user.id });
    expect(enabled).toContain(key); // global default true, no overrides active at this point
    expect(enabled).not.toContain(otherKey);

    await prismaWithoutTenantScoping.feature.deleteMany({ where: { key: otherKey } });
  });
});
