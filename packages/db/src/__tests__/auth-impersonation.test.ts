import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { registerPermissions } from "../permission-registry";
import { db } from "../client";
import { runWithTenant } from "../tenant-context";
import {
  endImpersonation,
  startImpersonation,
  TargetNotOrganizationMemberError,
} from "../auth/impersonation";
import { ForbiddenError } from "../authorization";
import { resolveSession } from "../auth/session";

const runId = Date.now().toString(36);
const IMPERSONATE_PERMISSION = "core.platform.impersonate_organization_admin";

describe("impersonation (FR-112)", () => {
  let superAdmin: { id: string };
  let plainPlatformUser: { id: string };
  let orgAdmin: { id: string };
  let outsider: { id: string };
  let org: { id: string };
  let platformRole: { id: string };

  beforeAll(async () => {
    await registerPermissions([
      { key: IMPERSONATE_PERMISSION, module: "core", scope: "PLATFORM" },
    ]);

    superAdmin = await prismaWithoutTenantScoping.user.create({ data: { email: `impersonator-${runId}@example.com` } });
    plainPlatformUser = await prismaWithoutTenantScoping.user.create({ data: { email: `plain-${runId}@example.com` } });
    orgAdmin = await prismaWithoutTenantScoping.user.create({ data: { email: `org-admin-${runId}@example.com` } });
    outsider = await prismaWithoutTenantScoping.user.create({ data: { email: `outsider-${runId}@example.com` } });
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Impersonation Org", slug: `impersonation-org-${runId}` },
    });
    await prismaWithoutTenantScoping.organizationMembership.create({
      data: { userId: orgAdmin.id, organizationId: org.id },
    });

    const permission = await prismaWithoutTenantScoping.permission.findUniqueOrThrow({
      where: { key: IMPERSONATE_PERMISSION },
    });
    platformRole = await prismaWithoutTenantScoping.platformRole.create({
      data: { name: "Impersonator", slug: `impersonator-role-${runId}` },
    });
    await prismaWithoutTenantScoping.platformRolePermission.create({
      data: { platformRoleId: platformRole.id, permissionId: permission.id },
    });
    await prismaWithoutTenantScoping.platformUserRole.create({
      data: { userId: superAdmin.id, platformRoleId: platformRole.id },
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.session.deleteMany({ where: { userId: orgAdmin.id } });
    await prismaWithoutTenantScoping.auditLog.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await prismaWithoutTenantScoping.platformUserRole.deleteMany({ where: { userId: superAdmin.id } });
    await prismaWithoutTenantScoping.user.deleteMany({
      where: { id: { in: [superAdmin.id, plainPlatformUser.id, orgAdmin.id, outsider.id] } },
    });
    await prismaWithoutTenantScoping.platformRolePermission.deleteMany({ where: { platformRoleId: platformRole.id } });
    await prismaWithoutTenantScoping.platformRole.deleteMany({ where: { id: platformRole.id } });
  });

  it("rejects a caller without the impersonation permission", async () => {
    await expect(
      startImpersonation({ impersonatorUserId: plainPlatformUser.id, targetUserId: orgAdmin.id, organizationId: org.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects impersonating a user who isn't a member of the target org", async () => {
    await expect(
      startImpersonation({ impersonatorUserId: superAdmin.id, targetUserId: outsider.id, organizationId: org.id }),
    ).rejects.toThrow(TargetNotOrganizationMemberError);
  });

  it("creates a time-boxed session tagged with the impersonator, and audit-logs the start", async () => {
    const { rawToken, session } = await startImpersonation({
      impersonatorUserId: superAdmin.id,
      targetUserId: orgAdmin.id,
      organizationId: org.id,
    });

    expect(session.userId).toBe(orgAdmin.id);
    expect(session.impersonatorUserId).toBe(superAdmin.id);
    expect(session.organizationId).toBe(org.id);
    // Time-boxed: much shorter than the ~30-day default session lifetime.
    expect(session.expiresAt.getTime() - Date.now()).toBeLessThan(31 * 60 * 1000);

    const resolved = await resolveSession(rawToken);
    expect(resolved.userId).toBe(orgAdmin.id);
    expect(resolved.impersonatorUserId).toBe(superAdmin.id);

    const logs = await runWithTenant(org.id, async () =>
      db.auditLog.findMany({ where: { action: "impersonation.started", resourceId: orgAdmin.id } }),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.actorUserId).toBe(superAdmin.id);
  });

  it("endImpersonation revokes the session and audit-logs the end", async () => {
    const { rawToken, session } = await startImpersonation({
      impersonatorUserId: superAdmin.id,
      targetUserId: orgAdmin.id,
      organizationId: org.id,
    });

    await endImpersonation(session.id);

    await expect(resolveSession(rawToken)).rejects.toThrow();

    const logs = await runWithTenant(org.id, async () =>
      db.auditLog.findMany({ where: { action: "impersonation.ended", resourceId: orgAdmin.id } }),
    );
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
