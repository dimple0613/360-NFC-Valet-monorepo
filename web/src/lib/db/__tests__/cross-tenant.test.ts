import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { auditIfCrossTenantAttempt } from "../cross-tenant";

const runId = Date.now().toString(36);

describe("auditIfCrossTenantAttempt (FR-104)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let roleInB: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "XT Org A", slug: `xt-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "XT Org B", slug: `xt-org-b-${runId}` },
    });
    roleInB = await runWithTenant(orgB.id, async () =>
      db.role.create({ data: { name: "B Role", slug: `xt-role-b-${runId}`, organizationId: orgB.id } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.role.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  });

  it("does NOT write an audit entry for a plain not-found (id exists nowhere)", async () => {
    await runWithTenant(orgA.id, async () => {
      const scopedResult = await db.role.findUnique({ where: { id: "does-not-exist-anywhere" } });
      expect(scopedResult).toBeNull();

      await auditIfCrossTenantAttempt(
        async () => {
          const found = await db.role.findUnique({ where: { id: "does-not-exist-anywhere" } });
          return found !== null;
        },
        { module: "core", resourceType: "Role", resourceId: "does-not-exist-anywhere" },
      );
    });

    const logs = await prismaWithoutTenantScoping.auditLog.findMany({
      where: { resourceId: "does-not-exist-anywhere" },
    });
    expect(logs).toHaveLength(0);
  });

  it("writes an audit entry when org A reaches for org B's real resource", async () => {
    await runWithTenant(orgA.id, async () => {
      const scopedResult = await db.role.findUnique({ where: { id: roleInB.id } });
      expect(scopedResult).toBeNull(); // cross-tenant lookup already denies existence

      await auditIfCrossTenantAttempt(
        async () => {
          const found = await db.role.findUnique({ where: { id: roleInB.id } });
          return found !== null;
        },
        { module: "core", resourceType: "Role", resourceId: roleInB.id, actorUserId: null },
      );
    });

    const logs = await prismaWithoutTenantScoping.auditLog.findMany({
      where: { resourceId: roleInB.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("cross_tenant_access_denied");
    // Logged against the ACTOR's org (A), not the target org (B) whose resource was reached for.
    expect(logs[0]?.organizationId).toBe(orgA.id);
  });
});
