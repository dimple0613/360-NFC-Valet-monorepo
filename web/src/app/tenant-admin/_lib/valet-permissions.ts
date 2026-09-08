import { forbidden } from "next/navigation";
import { getUserOrganizationPermissions } from "@saasclaude/db";
import { requireIdentity, type CurrentIdentity } from "@/lib/auth/current-user";

/**
 * Safely extracts a message from an unknown thrown value. The valet route
 * handlers surface error.message from the data layer (which throws plain
 * `Error`s like "Offer not found"), so narrowing `unknown` to Error keeps
 * that behavior without resorting to `any`.
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Extracts the PostgreSQL error code (e.g. "23505" unique violation) from an
 * unknown thrown value, or null when the value isn't a PG error carrying one.
 */
export function errorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

// Valet page gates: every Tenant Admin valet business page calls this with the
// permission that page needs (e.g. "valet.cards.read"), which both (a) 403s
// users whose role doesn't grant it and (b) returns the full permission list so
// the caller can drive client UI (buttons, dialogs) from the same data — no
// divergent UI-only check. Mirrors requirePlatformAccess on the Super Admin side.
export async function requireValetPage(permissionKey: string): Promise<
  CurrentIdentity & { permissions: string[] }
> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) forbidden();
  const permissions = await getUserOrganizationPermissions(identity.session.userId, organizationId);
  if (!permissions.includes(permissionKey)) forbidden();
  return { ...identity, permissions };
}

/**
 * Non-throwing variant for Route Handlers: returns true when the acting user
 * holds the permission inside the session's organization. Route handlers can't
 * rely on next/navigation's forbidden() (it needs an error boundary), so they
 * check this and respond with a plain 403 JSON instead.
 */
export async function assertValetPermission(permissionKey: string): Promise<boolean> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) return false;
  const permissions = await getUserOrganizationPermissions(identity.session.userId, organizationId);
  return permissions.includes(permissionKey);
}
