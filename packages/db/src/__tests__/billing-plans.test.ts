import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  createAddOn,
  createPlanVersion,
  getAddOn,
  getCurrentPlan,
  getPlanVersion,
  listAddOns,
  listPlans,
  setPlanVisibility,
} from "../billing/plans";
import { registerResourceTypes } from "../billing/resource-types";

const runId = Date.now().toString(36);
const planKey = `test-plan-${runId}`;
const resourceKey = `test-${runId}.plan-resource`;
const addOnKey = `test-addon-${runId}`;
const reportsFeatureKey = `test-${runId}.advanced_reports`;
const supportFeatureKey = `test-${runId}.priority_support`;

describe("plans (FR-180–183)", () => {
  afterAll(async () => {
    await prismaWithoutTenantScoping.planResource.deleteMany({ where: { plan: { key: planKey } } });
    await prismaWithoutTenantScoping.planFeature.deleteMany({ where: { plan: { key: planKey } } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: planKey } });
    await prismaWithoutTenantScoping.resourceType.deleteMany({ where: { key: resourceKey } });
    await prismaWithoutTenantScoping.addOnResource.deleteMany({ where: { addOn: { key: addOnKey } } });
    await prismaWithoutTenantScoping.addOnFeature.deleteMany({ where: { addOn: { key: addOnKey } } });
    await prismaWithoutTenantScoping.addOn.deleteMany({ where: { key: addOnKey } });
    await prismaWithoutTenantScoping.feature.deleteMany({
      where: { key: { in: [reportsFeatureKey, supportFeatureKey] } },
    });
  });

  it("createPlanVersion creates version 1 as current, with resources and features attached", async () => {
    await registerResourceTypes([
      {
        key: resourceKey,
        module: `test-module-${runId}`,
        displayName: "Seats",
        unit: "seats",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "BLOCK",
      },
    ]);
    // Features aren't registered via a service here (that's this same task's
    // features.ts, tested separately) — created directly, same as how other
    // tests create fixture Organizations via the raw client.
    await prismaWithoutTenantScoping.feature.create({
      data: { key: reportsFeatureKey, module: `test-module-${runId}`, name: "Advanced reports" },
    });
    await prismaWithoutTenantScoping.feature.create({
      data: { key: supportFeatureKey, module: `test-module-${runId}`, name: "Priority support" },
    });

    const plan = await createPlanVersion({
      key: planKey,
      name: "Pro",
      type: "MONTHLY",
      priceCents: 2900,
      billingCycle: "MONTHLY",
      resources: [{ resourceTypeKey: resourceKey, limit: 10 }],
      features: [{ featureKey: reportsFeatureKey }],
    });

    expect(plan.version).toBe(1);
    expect(plan.isCurrent).toBe(true);
    expect(plan.resources).toHaveLength(1);
    expect(plan.features).toHaveLength(1);
  });

  it("a second createPlanVersion call bumps the version and un-currents the first", async () => {
    const v2 = await createPlanVersion({ key: planKey, name: "Pro", type: "MONTHLY", priceCents: 3900 });
    expect(v2.version).toBe(2);
    expect(v2.isCurrent).toBe(true);

    const v1 = await getPlanVersion(planKey, 1);
    expect(v1?.isCurrent).toBe(false);
    expect(v1?.priceCents).toBe(2900); // old version's price is untouched — pinned (FR-182)

    const current = await getCurrentPlan(planKey);
    expect(current?.version).toBe(2);
    expect(current?.priceCents).toBe(3900);
  });

  it("listPlans returns only current versions, filterable by visibility", async () => {
    const plans = await listPlans();
    const matches = plans.filter((p) => p.key === planKey);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.version).toBe(2);

    const hiddenOnly = await listPlans({ visibility: ["HIDDEN"] });
    expect(hiddenOnly.some((p) => p.key === planKey)).toBe(false);
  });

  it("setPlanVisibility mutates visibility without creating a new version", async () => {
    const current = await getCurrentPlan(planKey);
    await setPlanVisibility(current!.id, "ARCHIVED");
    const updated = await getPlanVersion(planKey, 2);
    expect(updated?.visibility).toBe("ARCHIVED");
    expect(updated?.version).toBe(2); // still version 2 — visibility isn't a repricing event
  });

  it("createAddOn creates a purchasable bundle with resource grants and feature keys", async () => {
    const addOn = await createAddOn({
      key: addOnKey,
      name: "Extra seats",
      priceCents: 900,
      resources: [{ resourceTypeKey: resourceKey, grantAmount: 5 }],
      features: [supportFeatureKey],
    });
    expect(addOn.resources).toHaveLength(1);
    expect(addOn.resources[0]?.grantAmount).toBe(5);
    const supportFeature = await prismaWithoutTenantScoping.feature.findUniqueOrThrow({
      where: { key: supportFeatureKey },
    });
    expect(addOn.features.map((f) => f.featureId)).toEqual([supportFeature.id]);

    const fetched = await getAddOn(addOnKey);
    expect(fetched?.name).toBe("Extra seats");

    const all = await listAddOns();
    expect(all.some((a) => a.key === addOnKey)).toBe(true);
  });
});
