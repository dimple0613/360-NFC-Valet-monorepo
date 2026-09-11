import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { db } from "../client";
import {
  ForbiddenError,
  getUserOrganizationPermissions,
  getUserPlatformPermissions,
  listPlatformAdminsSearch,
  requireOrganizationPermission,
  requirePlatformPermission,
  userHasOrganizationPermission,
  userHasPlatformPermission,
} from "../authorization";
import { registerPermissions } from "../permission-registry";

const runId = Date.now().toString(36);
const tenantPermissionKey = `authz-test-${runId}.things.manage`;
const platformPermissionKey = `authz-test-${runId}.platform.manage`;

describe("authorization policy layer", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let user: { id: string };
  let managerRole: { id: string };

  beforeAll(async () => {
    await registerPermissions([
      { key: tenantPermissionKey, module: `authz-test-${runId}`, scope: "TENANT" },
      { key: platformPermissionKey, module: `authz-test-${runId}`, scope: "PLATFORM" },
    ]);

    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Authz Org A", slug: `authz-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Authz Org B", slug: `authz-org-b-${runId}` },
    });
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `authz-user-${runId}@example.com` },
    });

    const permission = await prismaWithoutTenantScoping.permission.findUniqueOrThrow({
      where: { key: tenantPermissionKey },
    });

    managerRole = await runWithTenant(orgA.id, async () => {
      const role = await db.role.create({
        data: { name: "Manager", slug: `manager-${runId}`, organizationId: orgA.id },
      });
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id, organizationId: orgA.id },
      });
      await db.userRole.create({
        data: { userId: user.id, roleId: role.id, organizationId: orgA.id },
      });
      return role;
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { organizationId: orgA.id } });
    await prismaWithoutTenantScoping.rolePermission.deleteMany({ where: { organizationId: orgA.id } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { id: managerRole.id } });
    await prismaWithoutTenantScoping.permission.deleteMany({
      where: { key: { in: [tenantPermissionKey, platformPermissionKey] } },
    });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  it("userHasOrganizationPermission is true for a permission granted via the user's role", async () => {
    await expect(
      userHasOrganizationPermission(user.id, orgA.id, tenantPermissionKey),
    ).resolves.toBe(true);
  });

  it("is false for a permission the role doesn't have", async () => {
    await expect(
      userHasOrganizationPermission(user.id, orgA.id, "some.other.permission"),
    ).resolves.toBe(false);
  });

  it("is false in a DIFFERENT organization, even for the same user and permission key", async () => {
    await expect(
      userHasOrganizationPermission(user.id, orgB.id, tenantPermissionKey),
    ).resolves.toBe(false);
  });

  it("getUserOrganizationPermissions returns exactly the granted keys", async () => {
    const keys = await getUserOrganizationPermissions(user.id, orgA.id);
    expect(keys).toEqual([tenantPermissionKey]);
  });

  it("getUserOrganizationPermissions ignores a UserRole row that points at another org's Role (belt and braces, same as userHasOrganizationPermission)", async () => {
    // UserRole.organizationId has no FK/constraint tying it to role.organizationId
    // (see schema.prisma) — this simulates a dangling cross-org row, the same
    // defensive scenario userHasOrganizationPermission already guards against.
    const foreignPermission = await prismaWithoutTenantScoping.permission.findUniqueOrThrow({
      where: { key: platformPermissionKey },
    });
    const foreignRole = await runWithTenant(orgB.id, async () => {
      const role = await db.role.create({
        data: { name: "Foreign Role", slug: `foreign-role-${runId}`, organizationId: orgB.id },
      });
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: foreignPermission.id, organizationId: orgB.id },
      });
      return role;
    });
    await prismaWithoutTenantScoping.userRole.create({
      data: { userId: user.id, roleId: foreignRole.id, organizationId: orgA.id },
    });

    const keys = await getUserOrganizationPermissions(user.id, orgA.id);
    expect(keys).toEqual([tenantPermissionKey]);
    expect(keys).not.toContain(platformPermissionKey);

    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { roleId: foreignRole.id } });
    await prismaWithoutTenantScoping.rolePermission.deleteMany({ where: { roleId: foreignRole.id } });
    await prismaWithoutTenantScoping.role.delete({ where: { id: foreignRole.id } });
  });

  it("requireOrganizationPermission resolves when allowed, throws ForbiddenError when not", async () => {
    await expect(
      requireOrganizationPermission({ userId: user.id, organizationId: orgA.id, permissionKey: tenantPermissionKey }),
    ).resolves.toBeUndefined();

    await expect(
      requireOrganizationPermission({ userId: user.id, organizationId: orgB.id, permissionKey: tenantPermissionKey }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("requireOrganizationPermission also enforces the FR-154 ABAC condition after the base check passes", async () => {
    await expect(
      requireOrganizationPermission({
        userId: user.id,
        organizationId: orgA.id,
        permissionKey: tenantPermissionKey,
        condition: () => false,
      }),
    ).rejects.toThrow(ForbiddenError);

    await expect(
      requireOrganizationPermission({
        userId: user.id,
        organizationId: orgA.id,
        permissionKey: tenantPermissionKey,
        condition: () => true,
      }),
    ).resolves.toBeUndefined();
  });

  it("platform permission checks are false with no PlatformUserRole assigned", async () => {
    await expect(userHasPlatformPermission(user.id, platformPermissionKey)).resolves.toBe(false);
    await expect(getUserPlatformPermissions(user.id)).resolves.toEqual([]);
    await expect(
      requirePlatformPermission({ userId: user.id, permissionKey: platformPermissionKey }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("platform permission checks are true once a PlatformRole grants it", async () => {
    const permission = await prismaWithoutTenantScoping.permission.findUniqueOrThrow({
      where: { key: platformPermissionKey },
    });
    const platformRole = await prismaWithoutTenantScoping.platformRole.create({
      data: { name: "Platform Manager", slug: `platform-manager-${runId}` },
    });
    await prismaWithoutTenantScoping.platformRolePermission.create({
      data: { platformRoleId: platformRole.id, permissionId: permission.id },
    });
    await prismaWithoutTenantScoping.platformUserRole.create({
      data: { userId: user.id, platformRoleId: platformRole.id },
    });

    await expect(userHasPlatformPermission(user.id, platformPermissionKey)).resolves.toBe(true);
    await expect(
      requirePlatformPermission({ userId: user.id, permissionKey: platformPermissionKey }),
    ).resolves.toBeUndefined();

    await prismaWithoutTenantScoping.platformUserRole.deleteMany({ where: { platformRoleId: platformRole.id } });
    await prismaWithoutTenantScoping.platformRolePermission.deleteMany({ where: { platformRoleId: platformRole.id } });
    await prismaWithoutTenantScoping.platformRole.delete({ where: { id: platformRole.id } });
  });

  it("listPlatformAdminsSearch filters by email/role name and paginates with a total count", async () => {
    const role = await prismaWithoutTenantScoping.platformRole.create({
      data: { name: `Search Role ${runId}`, slug: `search-role-${runId}` },
    });
    const assignment = await prismaWithoutTenantScoping.platformUserRole.create({
      data: { userId: user.id, platformRoleId: role.id },
    });

    const filtered = await listPlatformAdminsSearch({ q: `Search Role ${runId}` });
    expect(filtered.items.some((a) => a.id === assignment.id)).toBe(true);

    const byEmail = await listPlatformAdminsSearch({ q: `authz-user-${runId}` });
    expect(byEmail.items.some((a) => a.id === assignment.id)).toBe(true);

    await prismaWithoutTenantScoping.platformUserRole.delete({ where: { id: assignment.id } });
    await prismaWithoutTenantScoping.platformRole.delete({ where: { id: role.id } });
  });
});
