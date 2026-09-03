import { cookies } from "next/headers";
import { resolveSession, type ResolvedSession } from "@saasclaude/db";

// FR-105/FR-103: the session cookie is the web surface's actual credential —
// resolveSession (packages/db) looks it up against the real Session model
// (Phase 1B), replacing the placeholder plain-cookie org resolution that used
// to live in tenant/resolve-tenant.ts.

export const SESSION_COOKIE_NAME = "session_token";
// Mirrors session.ts's default 30-day lifetime. The two aren't derived from each
// other — if the configurable `security.session_lifetime_days` platform setting
// changes, this constant needs updating too, or the cookie could outlive (or
// undercut) the DB-side session it's carrying.
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export class NoSessionError extends Error {
  constructor() {
    super("No valid session — not logged in.");
    this.name = "NoSessionError";
  }
}

/** Reads the session cookie and resolves it against the DB; null if absent, expired, or revoked. */
export async function getCurrentSession(): Promise<ResolvedSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;
  try {
    return await resolveSession(rawToken);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<ResolvedSession> {
  const session = await getCurrentSession();
  if (!session) throw new NoSessionError();
  return session;
}

export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// FR-112 impersonation: the impersonation session replaces the admin's real
// session in the same cookie. Before swapping, snapshot the admin's current
// token into a short-lived backup cookie so "Stop impersonating" can restore
// it instead of logging the admin out. Lifetimes mirror the 30-minute
// impersonation window (with slack), so the backup can never outlive its
// purpose on its own.
const SESSION_COOKIE_BACKUP_NAME = "session_token_backup";
const SESSION_COOKIE_BACKUP_MAX_AGE_SECONDS = 45 * 60;

export async function rememberSessionForImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return;
  cookieStore.set(SESSION_COOKIE_BACKUP_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_BACKUP_MAX_AGE_SECONDS,
  });
}

/** Restores the pre-impersonation admin session cookie; returns its token, or null if no backup exists. */
export async function restoreSessionAfterImpersonation(): Promise<string | null> {
  const cookieStore = await cookies();
  const backup = cookieStore.get(SESSION_COOKIE_BACKUP_NAME)?.value;
  if (!backup) return null;
  cookieStore.set(SESSION_COOKIE_NAME, backup, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  cookieStore.delete(SESSION_COOKIE_BACKUP_NAME);
  return backup;
}
