import { afterAll, describe, expect, it } from "vitest";
import {
  db,
  getUserOrganizationPermissions,
  prismaWithoutTenantScoping,
  resolveSession,
  runWithTenant,
  setPlatformSetting,
} from "@saasclaude/db";
import { RegistrationDisabledError, signUpNewOrganization } from "../signup-flow";

const runId = Date.now().toString(36);

describe("signUpNewOrganization", () => {
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
      await prismaWithoutTenantScoping.organizationMembership.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await prismaWithoutTenantScoping.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("creates the user, the org, an active membership, and grants the Owner role with every tenant permission", async () => {
    const email = `signup-flow-${runId}@example.com`;
    const result = await signUpNewOrganization({
      organizationName: `Signup Flow Org ${runId}`,
      email,
      password: "correct-horse-battery-staple",
      name: "Flow Test",
    });
    createdOrgIds.push(result.organizationId);
    createdUserIds.push(result.userId);

    const membership = await prismaWithoutTenantScoping.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: result.organizationId, userId: result.userId } },
    });
    expect(membership.status).toBe("ACTIVE");

    // Owner role holds every registered TENANT permission.
    const grantedKeys = await getUserOrganizationPermissions(result.userId, result.organizationId);
    const allTenantPermissionKeys = (
      await prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" } })
    ).map((p) => p.key);
    expect(new Set(grantedKeys)).toEqual(new Set(allTenantPermissionKeys));

    // A real, resolvable session was created and scoped to the new org.
    const resolved = await resolveSession(result.sessionToken);
    expect(resolved.userId).toBe(result.userId);
    expect(resolved.organizationId).toBe(result.organizationId);
  });

  it("auto-generates a unique slug when the organization name collides", async () => {
    const orgName = `Collision Org ${runId}`;
    const first = await signUpNewOrganization({
      organizationName: orgName,
      email: `collision-a-${runId}@example.com`,
      password: "correct-horse-battery-staple",
    });
    createdOrgIds.push(first.organizationId);
    createdUserIds.push(first.userId);

    const second = await signUpNewOrganization({
      organizationName: orgName,
      email: `collision-b-${runId}@example.com`,
      password: "correct-horse-battery-staple",
    });
    createdOrgIds.push(second.organizationId);
    createdUserIds.push(second.userId);

    const orgs = await prismaWithoutTenantScoping.organization.findMany({
      where: { id: { in: [first.organizationId, second.organizationId] } },
    });
    const slugs = orgs.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(2); // distinct slugs despite identical names
  });

  it("rejects self-serve signup when the platform has disabled registration, and allows it again when re-enabled", async () => {
    try {
      await setPlatformSetting({ category: "access", key: "access.registration_enabled", value: false });
      await expect(
        signUpNewOrganization({
          organizationName: `Blocked Org ${runId}`,
          email: `blocked-${runId}@example.com`,
          password: "correct-horse-battery-staple",
        }),
      ).rejects.toBeInstanceOf(RegistrationDisabledError);

      // No user should have been created by the rejected attempt.
      const orphan = await prismaWithoutTenantScoping.user.findUnique({ where: { email: `blocked-${runId}@example.com` } });
      expect(orphan).toBeNull();
    } finally {
      await prismaWithoutTenantScoping.platformSetting.deleteMany({ where: { key: "access.registration_enabled" } });
    }

    const result = await signUpNewOrganization({
      organizationName: `Reenabled Org ${runId}`,
      email: `reenabled-${runId}@example.com`,
      password: "correct-horse-battery-staple",
    });
    createdOrgIds.push(result.organizationId);
    createdUserIds.push(result.userId);
    expect(result.organizationId).toBeTruthy();
  });

  it("the default role set (Owner/Admin/Member/Viewer) is queryable within the tenant-scoped client under the new org's context", async () => {
    const result = await signUpNewOrganization({
      organizationName: `Queryable Org ${runId}`,
      email: `queryable-${runId}@example.com`,
      password: "correct-horse-battery-staple",
    });
    createdOrgIds.push(result.organizationId);
    createdUserIds.push(result.userId);

    const roles = await runWithTenant(result.organizationId, async () => db.role.findMany());
    expect(new Set(roles.map((r) => r.slug))).toEqual(new Set(["owner", "admin", "member", "viewer"]));
  });
});
