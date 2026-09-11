import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { getResourceType, registerResourceTypes, ResourceTypeKeyConflictError } from "../billing/resource-types";

const runId = Date.now().toString(36);
const key = `test-module-${runId}.things`;

describe("registerResourceTypes", () => {
  afterAll(async () => {
    await prismaWithoutTenantScoping.resourceType.deleteMany({ where: { key } });
  });

  it("creates a new resource type", async () => {
    await registerResourceTypes([
      {
        key,
        module: `test-module-${runId}`,
        displayName: "Things",
        unit: "things",
        aggregation: "COUNTER",
        resetCycle: "MONTHLY",
        overagePolicy: "BLOCK",
      },
    ]);
    const found = await getResourceType(key);
    expect(found?.unit).toBe("things");
    expect(found?.aggregation).toBe("COUNTER");
  });

  it("is idempotent: re-registering the same module updates in place instead of duplicating", async () => {
    await registerResourceTypes([
      {
        key,
        module: `test-module-${runId}`,
        displayName: "Things v2",
        unit: "things",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "ALLOW",
      },
    ]);
    const matches = await prismaWithoutTenantScoping.resourceType.findMany({ where: { key } });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.displayName).toBe("Things v2");
    expect(matches[0]?.aggregation).toBe("GAUGE");
  });

  it("throws ResourceTypeKeyConflictError when a different module claims an existing key", async () => {
    await expect(
      registerResourceTypes([
        {
          key,
          module: `other-module-${runId}`,
          displayName: "Things",
          unit: "things",
          aggregation: "COUNTER",
          resetCycle: "MONTHLY",
          overagePolicy: "BLOCK",
        },
      ]),
    ).rejects.toThrow(ResourceTypeKeyConflictError);
  });
});
