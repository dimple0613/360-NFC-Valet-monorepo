import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { registerPermissions } from "../permission-registry";
import { maybeGrantBootstrapSuperAdmin } from "../auth/platform-bootstrap";

const runId = Date.now().toString(36);
const platformPermissionKey = `bootstrap-test-${runId}.platform.thing`;

describe("platform bootstrap", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAIL;
  const createdUserIds: string[] = [];

  afterEach(() => {
    process.env.SUPER_ADMIN_EMAIL = originalEnv;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.platformUserRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prismaWithoutTenantScoping.platformRolePermission.deleteMany({
      where: { permission: { key: platformPermissionKey } },
    });
    await prismaWithoutTenantScoping.permission.deleteMany({ where: { key: platformPermissionKey } });
  });

  it("does nothing when SUPER_ADMIN_EMAIL is unset", async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    const user = await prismaWithoutTenantScoping.user.create({ data: { email: `no-bootstrap-${runId}@example.com` } });
    createdUserIds.push(user.id);

    await maybeGrantBootstrapSuperAdmin(user.id, user.email);

    const roles = await prismaWithoutTenantScoping.platformUserRole.findMany({ where: { userId: user.id } });
    expect(roles).toHaveLength(0);
  });

  it("does nothing when the email doesn't match", async () => {
    process.env.SUPER_ADMIN_EMAIL = "someone-else@example.com";
    const user = await prismaWithoutTenantScoping.user.create({ data: { email: `not-matching-${runId}@example.com` } });
    createdUserIds.push(user.id);

    await maybeGrantBootstrapSuperAdmin(user.id, user.email);

    const roles = await prismaWithoutTenantScoping.platformUserRole.findMany({ where: { userId: user.id } });
    expect(roles).toHaveLength(0);
  });

  it("grants the Super Admin role, with every registered platform permission, on a matching email", async () => {
    await registerPermissions([{ key: platformPermissionKey, module: `bootstrap-test-${runId}`, scope: "PLATFORM" }]);

    const email = `bootstrap-${runId}@example.com`;
    process.env.SUPER_ADMIN_EMAIL = email;
    const user = await prismaWithoutTenantScoping.user.create({ data: { email } });
    createdUserIds.push(user.id);

    await maybeGrantBootstrapSuperAdmin(user.id, email);

    const platformUserRole = await prismaWithoutTenantScoping.platformUserRole.findFirst({
      where: { userId: user.id },
      include: { platformRole: { include: { permissions: { include: { permission: true } } } } },
    });
    expect(platformUserRole).not.toBeNull();
    expect(platformUserRole!.platformRole.slug).toBe("super-admin");
    expect(
      platformUserRole!.platformRole.permissions.some((p) => p.permission.key === platformPermissionKey),
    ).toBe(true);

    // Idempotent: calling again doesn't duplicate the assignment.
    await maybeGrantBootstrapSuperAdmin(user.id, email);
    const allRoles = await prismaWithoutTenantScoping.platformUserRole.findMany({ where: { userId: user.id } });
    expect(allRoles).toHaveLength(1);
  });
});
