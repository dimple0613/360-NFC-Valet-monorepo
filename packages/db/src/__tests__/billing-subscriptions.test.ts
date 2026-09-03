import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { db } from "../client";
import { registerResourceTypes } from "../billing/resource-types";
import { createAddOn, createPlanVersion } from "../billing/plans";
import {
  attachAddOn,
  cancelSubscription,
  createSubscription,
  detachAddOn,
  downgradeSubscription,
  executeDueCancellations,
  extendSubscription,
  getOrganizationResourceQuota,
  getResourceUsageSummary,
  InvalidSubscriptionTransitionError,
  manuallyAdjustSubscription,
  pauseSubscription,
  PlanNotFoundError,
  recordResourceUsageEnforced,
  renewSubscription,
  resumeSubscription,
  SubscriptionNotFoundError,
  terminateSubscription,
  upgradeSubscription,
} from "../billing/subscriptions";
import { ResourceQuotaExceededError } from "../billing/resource-consumption";
import { ImmutableRecordError } from "../tenant-scoping";

const runId = Date.now().toString(36);
const freePlanKey = `test-sub-free-${runId}`;
const proPlanKey = `test-sub-pro-${runId}`;
const resourceKey = `test-sub-${runId}.seats`;
const addOnKey = `test-sub-addon-${runId}`;

describe("subscription lifecycle (FR-160–163)", () => {
  let org: { id: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Sub Org", slug: `sub-org-${runId}` },
    });
    await registerResourceTypes([
      {
        key: resourceKey,
        module: `test-sub-${runId}`,
        displayName: "Seats",
        unit: "seats",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "BLOCK",
      },
    ]);
    await createPlanVersion({
      key: freePlanKey,
      name: "Free",
      type: "FREE",
      resources: [{ resourceTypeKey: resourceKey, limit: 2 }],
    });
    await createPlanVersion({
      key: proPlanKey,
      name: "Pro",
      type: "MONTHLY",
      billingCycle: "MONTHLY",
      priceCents: 2900,
      resources: [{ resourceTypeKey: resourceKey, limit: 50 }],
    });
    await createAddOn({
      key: addOnKey,
      name: "Extra seats",
      resources: [{ resourceTypeKey: resourceKey, grantAmount: 10 }],
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.subscriptionEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscriptionAddOn.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.resourceUsageEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await prismaWithoutTenantScoping.planResource.deleteMany({ where: { plan: { key: { in: [freePlanKey, proPlanKey] } } } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: { in: [freePlanKey, proPlanKey] } } });
    await prismaWithoutTenantScoping.addOnResource.deleteMany({ where: { addOn: { key: addOnKey } } });
    await prismaWithoutTenantScoping.addOn.deleteMany({ where: { key: addOnKey } });
    await prismaWithoutTenantScoping.resourceType.deleteMany({ where: { key: resourceKey } });
  });

  it("throws for an unknown plan key", async () => {
    await expect(createSubscription({ organizationId: org.id, planKey: "nonexistent" })).rejects.toThrow(
      PlanNotFoundError,
    );
  });

  it("createSubscription with no trial starts ACTIVE; with a trial starts TRIALING", async () => {
    const active = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    expect(active.status).toBe("ACTIVE");
    await terminateSubscription(org.id, active.id); // clean up this one, don't need it further

    const trialing = await createSubscription({ organizationId: org.id, planKey: proPlanKey, trialDays: 14 });
    expect(trialing.status).toBe("TRIALING");
    expect(trialing.trialEndsAt).not.toBeNull();
    await terminateSubscription(org.id, trialing.id);
  });

  it("full state machine: pause -> resume -> renew -> cancel(immediate) -> terminate rejected once already canceled+terminated", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    expect(sub.status).toBe("ACTIVE");

    const paused = await pauseSubscription(org.id, sub.id);
    expect(paused.status).toBe("PAUSED");
    await expect(pauseSubscription(org.id, sub.id)).rejects.toThrow(InvalidSubscriptionTransitionError);

    const resumed = await resumeSubscription(org.id, sub.id);
    expect(resumed.status).toBe("ACTIVE");

    const renewed = await renewSubscription(org.id, sub.id);
    expect(renewed.status).toBe("ACTIVE");
    expect(renewed.currentPeriodEnd.getTime()).toBeGreaterThan(sub.currentPeriodEnd.getTime());

    const canceled = await cancelSubscription(org.id, sub.id, { immediate: true });
    expect(canceled.status).toBe("CANCELED");

    const terminated = await terminateSubscription(org.id, sub.id);
    expect(terminated.status).toBe("TERMINATED");

    await expect(terminateSubscription(org.id, sub.id)).rejects.toThrow(InvalidSubscriptionTransitionError);
  });

  it("throws for an unknown subscription id", async () => {
    await expect(pauseSubscription(org.id, "does-not-exist")).rejects.toThrow(SubscriptionNotFoundError);
  });

  it("extendSubscription pushes currentPeriodEnd out without changing status", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    const extended = await extendSubscription(org.id, sub.id, 7);
    expect(extended.status).toBe(sub.status);
    expect(extended.currentPeriodEnd.getTime()).toBe(sub.currentPeriodEnd.getTime() + 7 * 86400000);
    await terminateSubscription(org.id, sub.id);
  });

  it("scheduled cancel sets cancelAt without changing status; executeDueCancellations finalizes it once due", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    const scheduled = await cancelSubscription(org.id, sub.id); // not immediate
    expect(scheduled.status).toBe("ACTIVE"); // unchanged — still active until cancelAt passes
    expect(scheduled.cancelAt).not.toBeNull();

    // Force cancelAt into the past to simulate it being due, then finalize.
    await prismaWithoutTenantScoping.subscription.update({
      where: { id: sub.id },
      data: { cancelAt: new Date(Date.now() - 1000) },
    });
    const finalizedIds = await executeDueCancellations();
    expect(finalizedIds).toContain(sub.id);

    const final = await prismaWithoutTenantScoping.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(final.status).toBe("CANCELED");
  });

  it("upgrade/downgrade change the plan and log both directions distinctly", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    const upgraded = await upgradeSubscription(org.id, sub.id, proPlanKey);
    const proPlan = await prismaWithoutTenantScoping.plan.findFirst({ where: { key: proPlanKey, isCurrent: true } });
    expect(upgraded.planId).toBe(proPlan!.id);

    const downgraded = await downgradeSubscription(org.id, sub.id, freePlanKey);
    const freePlan = await prismaWithoutTenantScoping.plan.findFirst({ where: { key: freePlanKey, isCurrent: true } });
    expect(downgraded.planId).toBe(freePlan!.id);

    const events = await runWithTenant(org.id, async () =>
      db.subscriptionEvent.findMany({ where: { subscriptionId: sub.id, type: { in: ["upgraded", "downgraded"] } } }),
    );
    expect(events.map((e) => e.type).sort()).toEqual(["downgraded", "upgraded"]);
    await terminateSubscription(org.id, sub.id);
  });

  it("manuallyAdjustSubscription requires a reason and records it", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    const newEnd = new Date(Date.now() + 999 * 86400000);
    const adjusted = await manuallyAdjustSubscription(
      org.id,
      sub.id,
      { currentPeriodEnd: newEnd },
      { reason: "goodwill extension after outage" },
    );
    expect(adjusted.currentPeriodEnd.getTime()).toBe(newEnd.getTime());

    const events = await runWithTenant(org.id, async () =>
      db.subscriptionEvent.findMany({ where: { subscriptionId: sub.id, type: "manually_adjusted" } }),
    );
    expect(events).toHaveLength(1);
    expect((events[0]?.metadata as { reason?: string } | null)?.reason).toBe(
      "goodwill extension after outage",
    );
    await terminateSubscription(org.id, sub.id);
  });

  it("subscription events are immutable", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    const events = await runWithTenant(org.id, async () =>
      db.subscriptionEvent.findMany({ where: { subscriptionId: sub.id } }),
    );
    await expect(
      runWithTenant(org.id, async () =>
        db.subscriptionEvent.update({ where: { id: events[0]!.id }, data: { type: "tampered" } }),
      ),
    ).rejects.toThrow(ImmutableRecordError);
    await terminateSubscription(org.id, sub.id);
  });

  it("attachAddOn / detachAddOn manage the join row", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    await attachAddOn(org.id, sub.id, addOnKey, 2);

    const attached = await runWithTenant(org.id, async () =>
      db.subscriptionAddOn.findFirst({ where: { subscriptionId: sub.id } }),
    );
    expect(attached?.quantity).toBe(2);

    await detachAddOn(org.id, sub.id, addOnKey);
    const afterDetach = await runWithTenant(org.id, async () =>
      db.subscriptionAddOn.findFirst({ where: { subscriptionId: sub.id } }),
    );
    expect(afterDetach).toBeNull();
    await terminateSubscription(org.id, sub.id);
  });

  it("getOrganizationResourceQuota resolves the limit from the org's active subscription's plan; null with none active", async () => {
    await expect(getOrganizationResourceQuota(org.id, resourceKey)).resolves.toBeNull();

    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey });
    await expect(getOrganizationResourceQuota(org.id, resourceKey)).resolves.toBe(2);

    await terminateSubscription(org.id, sub.id);
    await expect(getOrganizationResourceQuota(org.id, resourceKey)).resolves.toBeNull();
  });

  it("recordResourceUsageEnforced blocks usage beyond the org's actual plan quota", async () => {
    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey }); // limit 2
    await recordResourceUsageEnforced({ organizationId: org.id, resourceTypeKey: resourceKey, amount: 2 });
    await expect(
      recordResourceUsageEnforced({ organizationId: org.id, resourceTypeKey: resourceKey, amount: 1 }),
    ).rejects.toThrow(ResourceQuotaExceededError);
    await terminateSubscription(org.id, sub.id);
  });

  it("getResourceUsageSummary reports unit/overagePolicy from the resource-type catalog and limit resolved from the org's active subscription (null with none active)", async () => {
    const before = await getResourceUsageSummary(org.id);
    const beforeEntry = before.find((s) => s.resourceTypeKey === resourceKey);
    // `used` is cumulative across this whole file's other tests (GAUGE/NEVER resource, sums forever) —
    // asserted as "a real number", not an exact value, to avoid coupling to unrelated tests' side effects.
    expect(beforeEntry).toMatchObject({ resourceTypeKey: resourceKey, unit: "seats", limit: null, overagePolicy: "BLOCK" });
    expect(typeof beforeEntry?.used).toBe("number");

    const sub = await createSubscription({ organizationId: org.id, planKey: freePlanKey }); // limit 2

    const after = await getResourceUsageSummary(org.id);
    const afterEntry = after.find((s) => s.resourceTypeKey === resourceKey);
    expect(afterEntry).toMatchObject({ resourceTypeKey: resourceKey, unit: "seats", limit: 2, overagePolicy: "BLOCK" });
    expect(afterEntry?.used).toBe(beforeEntry?.used);

    await terminateSubscription(org.id, sub.id);
  });
});
