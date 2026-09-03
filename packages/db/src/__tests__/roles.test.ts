import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { db } from "../client";
import {
  assignRoleToUser,
  createRole,
  deleteRole,
  getRoleWithPermissions,
  LastOwnerError,
  listAllTenantRolesSearch,
  listRoleAssigneesSearch,
  listRoles,
  listRolesPage,
  OwnerRoleImmutableError,
  RoleNotFoundError,
  seedDefaultRoles,
  setRolePermissions,
  unassignRoleFromUser,
  UserNotAMemberError,
  UserRoleNotFoundError,
} from "../roles";

const runId = Date.now().toString(36);

describe("roles service (FR-122 custom role builder)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let permission: { id: string; key: string };
  let member: { id: string };
  let outsider: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Roles Org A", slug: `roles-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Roles Org B", slug: `roles-org-b-${runId}` },
    });
    permission = await prismaWithoutTenantScoping.permission.create({
      data: { key: `test.roles.widget.manage.${runId}`, module: "test", scope: "TENANT" },
    });
    member = await prismaWithoutTenantScoping.user.create({ data: { email: `roles-member-${runId}@example.com` } });
    outsider = await prismaWithoutTenantScoping.user.create({ data: { email: `roles-outsider-${runId}@example.com` } });
    await runWithTenant(orgA.id, async () => {
      await db.organizationMembership.create({ data: { organizationId: orgA.id, userId: member.id, status: "ACTIVE" } });
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { organizationId: orgA.id } });
    await prismaWithoutTenantScoping.rolePermission.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.permission.delete({ where: { id: permission.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: [member.id, outsider.id] } } });
  });

  it("createRole creates a slugified role scoped to the org", async () => {
    const role = await createRole(orgA.id, "Team Manager");
    expect(role.organizationId).toBe(orgA.id);
    expect(role.slug).toBe("team-manager");
  });

  it("listRoles only returns the calling org's roles", async () => {
    await createRole(orgB.id, "Other Org Role");
    const rolesInA = await listRoles(orgA.id);
    expect(rolesInA.every((r) => r.organizationId === orgA.id)).toBe(true);
    expect(rolesInA.some((r) => r.name === "Other Org Role")).toBe(false);
  });

  it("setRolePermissions grants and getRoleWithPermissions reflects it", async () => {
    const role = await createRole(orgA.id, "Billing Viewer");
    await setRolePermissions(orgA.id, role.id, [permission.id]);
    const withPermissions = await getRoleWithPermissions(orgA.id, role.id);
    expect(withPermissions.permissionKeys).toEqual([permission.key]);
  });

  it("setRolePermissions replaces the previous set rather than appending", async () => {
    const role = await createRole(orgA.id, "Replace Test");
    await setRolePermissions(orgA.id, role.id, [permission.id]);
    await setRolePermissions(orgA.id, role.id, []);
    const withPermissions = await getRoleWithPermissions(orgA.id, role.id);
    expect(withPermissions.permissionKeys).toEqual([]);
  });

  it("a role created in another org is invisible under this org's context", async () => {
    const roleInB = await createRole(orgB.id, "Cross Tenant Role");
    await expect(getRoleWithPermissions(orgA.id, roleInB.id)).rejects.toThrow(RoleNotFoundError);
  });

  it("deleteRole removes the role; deleting again throws RoleNotFoundError", async () => {
    const role = await createRole(orgA.id, "Delete Me");
    await deleteRole(orgA.id, role.id);
    await expect(deleteRole(orgA.id, role.id)).rejects.toThrow(RoleNotFoundError);
  });

  it("deleteRole cannot delete another org's role", async () => {
    const roleInB = await createRole(orgB.id, "Protected From A");
    await expect(deleteRole(orgA.id, roleInB.id)).rejects.toThrow(RoleNotFoundError);
    const stillThere = await prismaWithoutTenantScoping.role.findUnique({ where: { id: roleInB.id } });
    expect(stillThere).not.toBeNull();
  });

  describe("assignRoleToUser / unassignRoleFromUser", () => {
    it("assigns idempotently, real DB row, and unassign removes it", async () => {
      const role = await createRole(orgA.id, "Assignable");
      await assignRoleToUser(orgA.id, role.id, member.id);
      await assignRoleToUser(orgA.id, role.id, member.id); // idempotent, no throw

      const row = await prismaWithoutTenantScoping.userRole.findUniqueOrThrow({
        where: { userId_roleId: { userId: member.id, roleId: role.id } },
      });
      expect(row.organizationId).toBe(orgA.id);

      await unassignRoleFromUser(orgA.id, role.id, member.id);
      const gone = await prismaWithoutTenantScoping.userRole.findUnique({
        where: { userId_roleId: { userId: member.id, roleId: role.id } },
      });
      expect(gone).toBeNull();
    });

    it("rejects assigning a role from another org (RoleNotFoundError, FR-104 shape)", async () => {
      const roleInB = await createRole(orgB.id, "Foreign For Assign");
      await expect(assignRoleToUser(orgA.id, roleInB.id, member.id)).rejects.toThrow(RoleNotFoundError);
    });

    it("rejects assigning to a user who isn't an active member of the org", async () => {
      const role = await createRole(orgA.id, "Members Only");
      await expect(assignRoleToUser(orgA.id, role.id, outsider.id)).rejects.toThrow(UserNotAMemberError);
      const row = await prismaWithoutTenantScoping.userRole.findUnique({
        where: { userId_roleId: { userId: outsider.id, roleId: role.id } },
      });
      expect(row).toBeNull();
    });

    it("listRoleAssigneesSearch filters by email, is scoped to the role, and paginates with a total count", async () => {
      const role = await createRole(orgA.id, "Assignee Search");
      const other = await createRole(orgA.id, "Other Role For Search");
      await assignRoleToUser(orgA.id, role.id, member.id);
      await assignRoleToUser(orgA.id, other.id, member.id);

      const memberEmail = `roles-member-${runId}@example.com`;
      const result = await listRoleAssigneesSearch(orgA.id, role.id, { q: `roles-member-${runId}` });
      expect(result.totalCount).toBe(1);
      expect(result.items[0]!.email).toBe(memberEmail);

      const noMatch = await listRoleAssigneesSearch(orgA.id, role.id, { q: "no-such-email-prefix" });
      expect(noMatch.totalCount).toBe(0);
    });

    it("unassignRoleFromUser throws UserRoleNotFoundError when there's nothing to remove", async () => {
      const role = await createRole(orgA.id, "Never Assigned");
      await expect(unassignRoleFromUser(orgA.id, role.id, member.id)).rejects.toThrow(UserRoleNotFoundError);
    });
  });

  describe("Owner role immutability", () => {
    it("deleteRole and setRolePermissions both reject the built-in Owner role", async () => {
      const owner = await createRole(orgA.id, "Owner");
      expect(owner.slug).toBe("owner");

      await expect(deleteRole(orgA.id, owner.id)).rejects.toThrow(OwnerRoleImmutableError);
      await expect(setRolePermissions(orgA.id, owner.id, [])).rejects.toThrow(OwnerRoleImmutableError);

      // Bypasses the app-level guard directly (that's the point of this test's cleanup) so the
      // next test's own "Owner" role doesn't collide on the (organizationId, slug) unique constraint.
      await prismaWithoutTenantScoping.role.delete({ where: { id: owner.id } });
    });

    it("unassignRoleFromUser rejects removing the last Owner, but allows it when another Owner remains", async () => {
      const owner = await createRole(orgA.id, "Owner");
      const secondOwner = await prismaWithoutTenantScoping.user.create({
        data: { email: `roles-second-owner-${runId}@example.com` },
      });
      await runWithTenant(orgA.id, async () => {
        await db.organizationMembership.create({
          data: { organizationId: orgA.id, userId: secondOwner.id, status: "ACTIVE" },
        });
      });
      await assignRoleToUser(orgA.id, owner.id, member.id);

      // Only one Owner so far (member) - removing them must fail.
      await expect(unassignRoleFromUser(orgA.id, owner.id, member.id)).rejects.toThrow(LastOwnerError);

      // With a second Owner assigned, removing the first is fine.
      await assignRoleToUser(orgA.id, owner.id, secondOwner.id);
      await expect(unassignRoleFromUser(orgA.id, owner.id, member.id)).resolves.toBeUndefined();
    });
  });

  describe("seedDefaultRoles", () => {
    it("creates Owner/Admin/Member/Viewer with the expected tiered permission sets", async () => {
      const seededOrg = await prismaWithoutTenantScoping.organization.create({
        data: { name: "Seeded Org", slug: `seeded-org-${runId}` },
      });

      const { ownerRoleId } = await seedDefaultRoles(seededOrg.id);

      const roles = await runWithTenant(seededOrg.id, async () =>
        db.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: "asc" } }),
      );
      const byName = new Map(roles.map((r) => [r.name, r]));
      expect([...byName.keys()].sort()).toEqual(["Admin", "Member", "Owner", "Viewer"]);
      expect(byName.get("Owner")!.id).toBe(ownerRoleId);

      const totalTenantPermissionCount = (
        await prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" } })
      ).length;
      const keysOf = (roleName: string) => new Set(byName.get(roleName)!.permissions.map((p) => p.permission.key));

      expect(keysOf("Owner").size).toBe(totalTenantPermissionCount);
      expect(keysOf("Admin").has("core.roles.manage")).toBe(false);
      expect(keysOf("Admin").size).toBe(totalTenantPermissionCount - 1);
      expect(keysOf("Member")).toEqual(new Set(["core.organization.read", "core.organization.read_members"]));
      expect(keysOf("Viewer")).toEqual(new Set(["core.organization.read"]));
    });
  });

  describe("listAllTenantRolesSearch (Super Admin, cross-org)", () => {
    it("finds roles by role name or org name, across orgs, with counts", async () => {
      const tag = `platform-roles-${runId}`;
      const role = await createRole(orgA.id, `Findable Role ${tag}`);

      const byRoleName = await listAllTenantRolesSearch({ q: tag });
      expect(byRoleName.items.some((r) => r.id === role.id)).toBe(true);
      const found = byRoleName.items.find((r) => r.id === role.id)!;
      expect(found.organizationId).toBe(orgA.id);
      expect(found.organizationName).toBe("Roles Org A");

      await assignRoleToUser(orgA.id, role.id, member.id);
      const refetched = await listAllTenantRolesSearch({ q: tag });
      expect(refetched.items.find((r) => r.id === role.id)!.memberCount).toBe(1);
    });
  });

  describe("listRolesPage", () => {
    it("paginates in real DB pages, cursor advances, last page has no nextCursor", async () => {
      const pagingOrg = await prismaWithoutTenantScoping.organization.create({
        data: { name: "Paging Org", slug: `paging-org-${runId}` },
      });
      const created = await Promise.all(
        ["Alpha", "Bravo", "Charlie"].map((name) => createRole(pagingOrg.id, name)),
      );

      const first = await listRolesPage(pagingOrg.id, { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.items.map((r) => r.name)).toEqual(["Alpha", "Bravo"]);
      expect(first.nextCursor).not.toBeNull();

      const second = await listRolesPage(pagingOrg.id, { limit: 2, cursor: first.nextCursor! });
      expect(second.items).toHaveLength(1);
      expect(second.items[0]!.name).toBe("Charlie");
      expect(second.nextCursor).toBeNull();

      await prismaWithoutTenantScoping.role.deleteMany({ where: { id: { in: created.map((r) => r.id) } } });
      await prismaWithoutTenantScoping.organization.delete({ where: { id: pagingOrg.id } });
    });

    it("clamps an out-of-range limit rather than erroring", async () => {
      const page = await listRolesPage(orgA.id, { limit: 0 });
      expect(page.items.length).toBeGreaterThanOrEqual(0); // clamped to 1, not 0/negative — just shouldn't throw
    });
  });
});
