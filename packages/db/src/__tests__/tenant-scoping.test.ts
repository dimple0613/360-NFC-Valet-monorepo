import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping } from "../index";
import { MissingTenantContextError, runWithTenant, unsafeRunWithoutTenantScoping } from "../tenant-context";

// FR-101/FR-102 regression coverage: a query issued with no explicit org filter
// must still be unable to cross tenants, because the scoping layer injects that
// filter itself. These run against a live local Postgres (see web/README.md).
//
// Every runWithTenant/unsafeRunWithoutTenantScoping callback below awaits its
// Prisma call internally — see the doc comment on runWithTenant for why that's
// required (Prisma's lazy PrismaPromise only dispatches on `.then()`, so the
// dispatch has to happen while the AsyncLocalStorage context is still active).

const runId = Date.now().toString(36);

describe("automatic tenant scoping", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let membershipInA: { id: string };
  let membershipInB: { id: string };

  beforeAll(async () => {
    // Organization itself isn't tenant-scoped (it IS the tenant), so this
    // legitimately goes through the raw client. Same for User (global, not
    // owned by any one organization — FR-105).
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Org A", slug: `org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Org B", slug: `org-b-${runId}` },
    });
    userA = await prismaWithoutTenantScoping.user.create({
      data: { email: `scoping-user-a-${runId}@example.com` },
    });
    userB = await prismaWithoutTenantScoping.user.create({
      data: { email: `scoping-user-b-${runId}@example.com` },
    });

    // organizationId is passed here to satisfy Prisma's generated input type
    // (OrganizationMembership's "unchecked create" input requires it
    // structurally) — it also happens to be the right value, but the
    // "spoofed" test below proves the extension enforces the active tenant's
    // id regardless of whatever value is actually passed here.
    membershipInA = await runWithTenant(orgA.id, async () =>
      db.organizationMembership.create({ data: { userId: userA.id, organizationId: orgA.id } }),
    );
    membershipInB = await runWithTenant(orgB.id, async () =>
      db.organizationMembership.create({ data: { userId: userB.id, organizationId: orgB.id } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  });

  it("findMany with no explicit org filter only returns the active tenant's rows", async () => {
    const memberships = await runWithTenant(orgA.id, async () =>
      db.organizationMembership.findMany({ where: { userId: { in: [userA.id, userB.id] } } }),
    );
    expect(memberships.map((m) => m.id)).toEqual([membershipInA.id]);
  });

  it("findUnique by another org's id returns null instead of leaking the row", async () => {
    const found = await runWithTenant(orgA.id, async () =>
      db.organizationMembership.findUnique({ where: { id: membershipInB.id } }),
    );
    expect(found).toBeNull();
  });

  it("update against another org's id affects nothing (throws, doesn't cross tenants)", async () => {
    await expect(
      runWithTenant(orgA.id, async () =>
        db.organizationMembership.update({ where: { id: membershipInB.id }, data: { status: "SUSPENDED" } }),
      ),
    ).rejects.toThrow();

    const stillIntact = await prismaWithoutTenantScoping.organizationMembership.findUnique({
      where: { id: membershipInB.id },
    });
    expect(stillIntact?.status).toBe("ACTIVE");
  });

  it("delete against another org's id affects nothing", async () => {
    await expect(
      runWithTenant(orgA.id, async () => db.organizationMembership.delete({ where: { id: membershipInB.id } })),
    ).rejects.toThrow();

    const stillExists = await prismaWithoutTenantScoping.organizationMembership.findUnique({
      where: { id: membershipInB.id },
    });
    expect(stillExists).not.toBeNull();
  });

  it("create ignores a spoofed organizationId and always uses the active tenant", async () => {
    const spoofUser = await prismaWithoutTenantScoping.user.create({
      data: { email: `scoping-spoof-${runId}@example.com` },
    });
    const created = await runWithTenant(orgA.id, async () =>
      db.organizationMembership.create({ data: { userId: spoofUser.id, organizationId: orgB.id } }),
    );
    expect(created.organizationId).toBe(orgA.id);
    await prismaWithoutTenantScoping.organizationMembership.delete({ where: { id: created.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: spoofUser.id } });
  });

  it("throws MissingTenantContextError when no tenant context is set", async () => {
    await expect(db.organizationMembership.findMany()).rejects.toThrow(MissingTenantContextError);
  });

  it("unsafeRunWithoutTenantScoping deliberately sees across tenants", async () => {
    const all = await unsafeRunWithoutTenantScoping(async () =>
      db.organizationMembership.findMany({ where: { userId: { in: [userA.id, userB.id] } } }),
    );
    expect(all.map((m) => m.id).sort()).toEqual([membershipInA.id, membershipInB.id].sort());
  });
});

describe("RBAC models get the same scoping (Role is tenant-scoped, Permission/PlatformRole are not)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let roleInA: { id: string };
  let roleInB: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "RBAC Org A", slug: `rbac-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "RBAC Org B", slug: `rbac-org-b-${runId}` },
    });

    roleInA = await runWithTenant(orgA.id, async () =>
      db.role.create({ data: { name: "Admin", slug: `admin-${runId}`, organizationId: orgA.id } }),
    );
    roleInB = await runWithTenant(orgB.id, async () =>
      db.role.create({ data: { name: "Admin", slug: `admin-${runId}`, organizationId: orgB.id } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.role.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  });

  it("Role findMany with no explicit org filter only returns the active tenant's rows", async () => {
    const roles = await runWithTenant(orgA.id, async () =>
      db.role.findMany({ where: { slug: `admin-${runId}` } }),
    );
    expect(roles.map((r) => r.id)).toEqual([roleInA.id]);
  });

  it("Role findUnique by another org's id returns null", async () => {
    const found = await runWithTenant(orgA.id, async () => db.role.findUnique({ where: { id: roleInB.id } }));
    expect(found).toBeNull();
  });

  it("Permission (global catalog) and PlatformRole are usable with no tenant context at all", async () => {
    // These two are deliberately absent from TENANT_SCOPED_MODELS — they're
    // platform-level/global, not per-organization, so they must work outside
    // any runWithTenant call.
    await expect(prismaWithoutTenantScoping.permission.findMany()).resolves.toBeDefined();
    await expect(prismaWithoutTenantScoping.platformRole.findMany()).resolves.toBeDefined();
  });
});
