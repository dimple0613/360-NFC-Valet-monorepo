import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { PermissionKeyConflictError, registerPermissions } from "../permission-registry";

const runId = Date.now().toString(36);
const key = `test-module-${runId}.things.do`;

describe("registerPermissions", () => {
  afterAll(async () => {
    await prismaWithoutTenantScoping.permission.deleteMany({ where: { key } });
  });

  it("creates a new permission", async () => {
    await registerPermissions([
      { key, module: `test-module-${runId}`, scope: "TENANT", description: "v1" },
    ]);
    const found = await prismaWithoutTenantScoping.permission.findUnique({ where: { key } });
    expect(found?.description).toBe("v1");
  });

  it("is idempotent: re-registering the same module updates in place instead of duplicating", async () => {
    await registerPermissions([
      { key, module: `test-module-${runId}`, scope: "TENANT", description: "v2" },
    ]);
    const matches = await prismaWithoutTenantScoping.permission.findMany({ where: { key } });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.description).toBe("v2");
  });

  it("throws PermissionKeyConflictError when a different module claims an existing key", async () => {
    await expect(
      registerPermissions([{ key, module: `other-module-${runId}`, scope: "TENANT" }]),
    ).rejects.toThrow(PermissionKeyConflictError);
  });
});
