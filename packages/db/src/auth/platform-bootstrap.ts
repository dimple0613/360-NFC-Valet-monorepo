import { prismaWithoutTenantScoping } from "../client";

// Bootstrapping problem: the Super Admin portal requires an existing platform
// admin to grant platform admin access to anyone, including the first one.
// Standard resolution: an operator-controlled env var. Whoever signs up (via
// the normal public signup flow) with an email matching SUPER_ADMIN_EMAIL
// automatically gets a "Super Admin" PlatformRole holding every registered
// PLATFORM-scope permission — idempotent, safe to leave set permanently (it
// only ever grants the same role to the same email, never revokes anything).

const SUPER_ADMIN_ROLE_SLUG = "super-admin";

async function ensureSuperAdminRole(): Promise<{ id: string }> {
  const permissions = await prismaWithoutTenantScoping.permission.findMany({ where: { scope: "PLATFORM" } });

  const role = await prismaWithoutTenantScoping.platformRole.upsert({
    where: { slug: SUPER_ADMIN_ROLE_SLUG },
    create: { name: "Super Admin", slug: SUPER_ADMIN_ROLE_SLUG, description: "Full platform access." },
    update: {},
  });

  for (const permission of permissions) {
    await prismaWithoutTenantScoping.platformRolePermission.upsert({
      where: { platformRoleId_permissionId: { platformRoleId: role.id, permissionId: permission.id } },
      create: { platformRoleId: role.id, permissionId: permission.id },
      update: {},
    });
  }

  return role;
}

export async function maybeGrantBootstrapSuperAdmin(userId: string, email: string): Promise<void> {
  const bootstrapEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!bootstrapEmail || bootstrapEmail.toLowerCase() !== email.toLowerCase()) return;

  const role = await ensureSuperAdminRole();
  await prismaWithoutTenantScoping.platformUserRole.upsert({
    where: { userId_platformRoleId: { userId, platformRoleId: role.id } },
    create: { userId, platformRoleId: role.id },
    update: {},
  });
}
