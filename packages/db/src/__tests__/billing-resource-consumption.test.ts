import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping, db } from "../client";
import { runWithTenant } from "../tenant-context";
import { registerResourceTypes } from "../billing/resource-types";
import {
  getResourceUsage,
  recordResourceUsage,
  recordResourceUsageWithQuota,
  ResourceQuotaExceededError,
  UnknownResourceTypeError,
} from "../billing/resource-consumption";
import { ImmutableRecordError } from "../tenant-scoping";

const runId = Date.now().toString(36);
const counterKey = `test-${runId}.counter`;
const gaugeKey = `test-${runId}.gauge`;
const blockKey = `test-${runId}.block`;
const module = `test-module-${runId}`;

describe("resource consumption tracking (FR-173)", () => {
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    await registerResourceTypes([
      {
        key: counterKey,
        module,
        displayName: "Counter thing",
        unit: "things",
        aggregation: "COUNTER",
        resetCycle: "MONTHLY",
        overagePolicy: "BLOCK",
      },
      {
        key: gaugeKey,
        module,
        displayName: "Gauge thing",
        unit: "things",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "ALLOW",
      },
      {
        key: blockKey,
        module,
        displayName: "Blocked thing",
        unit: "things",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "BLOCK",
      },
    ]);
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Usage Org A", slug: `usage-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Usage Org B", slug: `usage-org-b-${runId}` },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.resourceUsageEvent.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.resourceType.deleteMany({
      where: { key: { in: [counterKey, gaugeKey, blockKey] } },
    });
  });

  it("throws for an unregistered resource type", async () => {
    await expect(
      recordResourceUsage({ organizationId: orgA.id, resourceTypeKey: "nonexistent.key", amount: 1 }),
    ).rejects.toThrow(UnknownResourceTypeError);
  });

  it("recordResourceUsage + getResourceUsage: COUNTER sums all events within the current period", async () => {
    await recordResourceUsage({ organizationId: orgA.id, resourceTypeKey: counterKey, amount: 3 });
    await recordResourceUsage({ organizationId: orgA.id, resourceTypeKey: counterKey, amount: 4 });
    await expect(getResourceUsage(orgA.id, counterKey)).resolves.toBe(7);
  });

  it("usage is isolated per organization", async () => {
    await recordResourceUsage({ organizationId: orgB.id, resourceTypeKey: counterKey, amount: 100 });
    await expect(getResourceUsage(orgA.id, counterKey)).resolves.toBe(7);
    await expect(getResourceUsage(orgB.id, counterKey)).resolves.toBe(100);
  });

  it("GAUGE nets positive and negative deltas (e.g. seats added/removed)", async () => {
    await recordResourceUsage({ organizationId: orgA.id, resourceTypeKey: gaugeKey, amount: 5 });
    await recordResourceUsage({ organizationId: orgA.id, resourceTypeKey: gaugeKey, amount: -2 });
    await expect(getResourceUsage(orgA.id, gaugeKey)).resolves.toBe(3);
  });

  it("recordResourceUsageWithQuota allows usage under the limit and blocks usage over it (BLOCK overage policy)", async () => {
    await recordResourceUsageWithQuota(
      { organizationId: orgA.id, resourceTypeKey: blockKey, amount: 3 },
      /* quotaLimit */ 10,
    );
    await expect(getResourceUsage(orgA.id, blockKey)).resolves.toBe(3);

    await expect(
      recordResourceUsageWithQuota({ organizationId: orgA.id, resourceTypeKey: blockKey, amount: 100 }, 10),
    ).rejects.toThrow(ResourceQuotaExceededError);
    // Rejected attempt must not have been recorded.
    await expect(getResourceUsage(orgA.id, blockKey)).resolves.toBe(3);
  });

  it("quotaLimit: null means unlimited — never blocks, even under a BLOCK overage policy", async () => {
    await recordResourceUsageWithQuota(
      { organizationId: orgA.id, resourceTypeKey: blockKey, amount: 1000 },
      null,
    );
    await expect(getResourceUsage(orgA.id, blockKey)).resolves.toBe(1003);
  });

  it("ALLOW overage policy never blocks, regardless of the limit passed", async () => {
    await recordResourceUsageWithQuota(
      { organizationId: orgA.id, resourceTypeKey: gaugeKey, amount: 1000 },
      /* quotaLimit */ 1,
    );
    await expect(getResourceUsage(orgA.id, gaugeKey)).resolves.toBe(1003);
  });

  it("usage events are immutable — update/delete throw", async () => {
    const events = await runWithTenant(orgA.id, async () =>
      db.resourceUsageEvent.findMany({ where: { resourceTypeKey: gaugeKey } }),
    );
    const first = events[0]!;
    await expect(
      runWithTenant(orgA.id, async () =>
        db.resourceUsageEvent.update({ where: { id: first.id }, data: { amount: 999 } }),
      ),
    ).rejects.toThrow(ImmutableRecordError);
  });
});
