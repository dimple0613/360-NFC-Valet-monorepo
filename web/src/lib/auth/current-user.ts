import { unauthorized, forbidden } from "next/navigation";
import {
  getUserOrganizationPermissions,
  getUserPlatformPermissions,
  prismaWithoutTenantScoping,
  type ResolvedSession,
} from "@saasclaude/db";
import { getCurrentSession } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

export interface CurrentIdentity {
  session: ResolvedSession;
  user: CurrentUser;
}

async function loadIdentity(session: ResolvedSession): Promise<CurrentIdentity> {
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: session.userId } });
  return { session, user: { id: user.id, email: user.email, name: user.name } };
}

/** Renders Next's unauthorized() boundary (web/src/app/unauthorized.tsx) if there's no valid session. */
export async function requireIdentity(): Promise<CurrentIdentity> {
  const session = await getCurrentSession();
  if (!session) unauthorized();
  return loadIdentity(session);
}

/**
 * Gate for the Super Admin portal layout: requires a session AND the given
 * platform permission. FR-153's "UI visibility derives from the same
 * permission data" — this reads the same getUserPlatformPermissions the
 * layout's nav uses to decide what to show.
 */
export async function requirePlatformAccess(permissionKey: string): Promise<CurrentIdentity> {
  const identity = await requireIdentity();
  const permissions = await getUserPlatformPermissions(identity.session.userId);
  if (!permissions.includes(permissionKey)) forbidden();
  return identity;
}

/**
 * Coarser gate for the Super Admin portal *shell* itself: requires a session
 * with at least one platform permission (i.e. is a platform admin at all),
 * not any specific one — individual sections (Organizations, Billing, ...)
 * do their own requirePlatformAccess(specificKey) check, same pattern as
 * Tenant Admin's layout (broad session gate) + per-mutating-action checks.
 * Returns the full permission list too, so the sidebar can decide which
 * sections to show without a second query (FR-153: UI visibility from the
 * same permission data the server check used).
 */
export async function requirePlatformIdentity(): Promise<CurrentIdentity & { permissions: string[] }> {
  const identity = await requireIdentity();
  const permissions = await getUserPlatformPermissions(identity.session.userId);
  if (permissions.length === 0) forbidden();
  return { ...identity, permissions };
}

/**
 * Gate for the Tenant Admin portal layout: requires a session with an active
 * organization AND the given tenant permission within it.
 */
export async function requireOrganizationAccess(permissionKey: string): Promise<CurrentIdentity> {
  const identity = await requireIdentity();
  if (!identity.session.organizationId) forbidden();
  const permissions = await getUserOrganizationPermissions(identity.session.userId, identity.session.organizationId);
  if (!permissions.includes(permissionKey)) forbidden();
  return identity;
}
