import { prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { writeAuditLog } from "../audit-log";
import { requirePlatformPermission } from "../authorization";
import { createSession, revokeSession, type CreatedSession } from "./session";

// FR-112: Super Admins can impersonate any organization administrator without
// a password; impersonation is time-boxed, visibly indicated, and fully
// audit-logged. Implemented as a special Session (impersonatorUserId set,
// expiresAt far shorter than normal) rather than a separate mechanism — the
// rest of the app (tenant context, permission checks) just sees `userId` as
// the impersonated admin and works unmodified; the banner (web layer) and
// this audit trail are what make it "visibly indicated."

const IMPERSONATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const IMPERSONATE_PERMISSION = "core.platform.impersonate_organization_admin";

export class TargetNotOrganizationMemberError extends Error {
  constructor() {
    super("Cannot impersonate a user who is not a member of the target organization.");
    this.name = "TargetNotOrganizationMemberError";
  }
}

export async function startImpersonation(params: {
  impersonatorUserId: string;
  targetUserId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CreatedSession> {
  await requirePlatformPermission({ userId: params.impersonatorUserId, permissionKey: IMPERSONATE_PERMISSION });

  const membership = await prismaWithoutTenantScoping.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: params.organizationId, userId: params.targetUserId } },
  });
  if (!membership || membership.status !== "ACTIVE") throw new TargetNotOrganizationMemberError();

  const created = await createSession({
    userId: params.targetUserId,
    organizationId: params.organizationId,
    impersonatorUserId: params.impersonatorUserId,
    expiresInMs: IMPERSONATION_DURATION_MS,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await runWithTenant(params.organizationId, async () => {
    await writeAuditLog({
      module: "core",
      action: "impersonation.started",
      actorUserId: params.impersonatorUserId,
      resourceType: "User",
      resourceId: params.targetUserId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  });

  return created;
}

export async function endImpersonation(sessionId: string): Promise<void> {
  const session = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: sessionId } });
  await revokeSession(sessionId);

  if (session.organizationId && session.impersonatorUserId) {
    await runWithTenant(session.organizationId, async () => {
      await writeAuditLog({
        module: "core",
        action: "impersonation.ended",
        actorUserId: session.impersonatorUserId,
        resourceType: "User",
        resourceId: session.userId,
      });
    });
  }
}
