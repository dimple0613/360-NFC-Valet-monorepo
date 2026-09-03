import { createHash, randomBytes } from "node:crypto";
import type { Session } from "../../generated/client";
import { prismaWithoutTenantScoping } from "../client";
import { resolveSetting } from "../settings";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "../list-query";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "../pagination";

// FR-223: active session/device list, revocation, configurable lifetime.
// Opaque random token, only its hash stored (same reasoning as
// verification-tokens.ts) — the raw token is the bearer credential (session
// cookie), so a DB leak alone can't let someone replay a session.

const TOKEN_BYTES = 32;
const DEFAULT_SESSION_LIFETIME_DAYS = 30;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export class InvalidSessionError extends Error {
  constructor() {
    super("Session is invalid, expired, or has been revoked.");
    this.name = "InvalidSessionError";
  }
}

export class NotAMemberError extends Error {
  constructor() {
    super("Cannot switch to an organization you are not an active member of.");
    this.name = "NotAMemberError";
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`No session with id ${sessionId}.`);
    this.name = "SessionNotFoundError";
  }
}

export interface CreateSessionInput {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  /** FR-112: set on an impersonation session — see impersonation.ts, which is the only caller that should ever pass this. */
  impersonatorUserId?: string;
  /** Overrides the configurable default lifetime — impersonation.ts uses this for a much shorter, time-boxed expiry. */
  expiresInMs?: number;
}

export interface CreatedSession {
  rawToken: string;
  session: Session;
}

/**
 * FR-223's "configurable session lifetime setting" — reads
 * `security.session_lifetime_days`, an organization can override the
 * platform default for its own sessions (resolveSetting's org-over-platform
 * precedence), falls back to 30 if neither is set.
 */
export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const resolved = input.expiresInMs
    ? undefined
    : await resolveSetting<number>({
        key: "security.session_lifetime_days",
        organizationId: input.organizationId ?? undefined,
      });
  const lifetimeMs =
    input.expiresInMs ?? (resolved?.value ?? DEFAULT_SESSION_LIFETIME_DAYS) * 24 * 60 * 60 * 1000;
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const session = await prismaWithoutTenantScoping.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(rawToken),
      organizationId: input.organizationId ?? null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      impersonatorUserId: input.impersonatorUserId,
      expiresAt: new Date(Date.now() + lifetimeMs),
    },
  });
  return { rawToken, session };
}

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  organizationId: string | null;
  /** FR-112: non-null when this is an impersonation session — who's really behind it. */
  impersonatorUserId: string | null;
}

/** Looks up a session by its raw token, rejecting expired/revoked ones, and bumps lastUsedAt. */
export async function resolveSession(rawToken: string): Promise<ResolvedSession> {
  const session = await prismaWithoutTenantScoping.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!session || session.revokedAt !== null || session.expiresAt.getTime() < Date.now()) {
    throw new InvalidSessionError();
  }
  await prismaWithoutTenantScoping.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });
  return {
    sessionId: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    impersonatorUserId: session.impersonatorUserId,
  };
}

/**
 * FR-105: picks which organization a freshly-logging-in session should start
 * in — the earliest ACTIVE membership. Every user able to log in via a
 * password (signUp or acceptOrganizationInvite) has at least one by the time
 * they can authenticate, so this is only null for a user with zero active
 * memberships (all removed/suspended since). Login call sites should pass
 * this into createSession — a session with no organizationId can't reach any
 * organization-scoped page, so skipping this silently strands the user on
 * the login screen with no error shown, indistinguishable from a failed login.
 */
export async function getDefaultOrganizationId(userId: string): Promise<string | null> {
  const membership = await prismaWithoutTenantScoping.organizationMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  return membership?.organizationId ?? null;
}

/** FR-105: switch the session's active organization — the user must be an active member of it. */
export async function switchSessionOrganization(sessionId: string, organizationId: string): Promise<void> {
  const session = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: sessionId } });
  const membership = await prismaWithoutTenantScoping.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.userId } },
  });
  if (!membership || membership.status !== "ACTIVE") throw new NotAMemberError();
  await prismaWithoutTenantScoping.session.update({ where: { id: sessionId }, data: { organizationId } });
}

export async function listUserSessions(userId: string): Promise<Session[]> {
  return prismaWithoutTenantScoping.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
  });
}

const SESSION_SORT_FIELDS = ["lastUsedAt", "createdAt", "expiresAt", "userAgent"] as const;

/** Offset-paginated, searchable, sortable variant for the DataTable UI. */
export async function listUserSessionsSearch(
  userId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<Session>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = SESSION_SORT_FIELDS.includes(params.sortBy as (typeof SESSION_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof SESSION_SORT_FIELDS)[number])
    : "lastUsedAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    userId,
    revokedAt: null,
    expiresAt: { gt: new Date() },
    ...(params.q
      ? {
          OR: [
            { userAgent: { contains: params.q, mode: "insensitive" as const } },
            { ipAddress: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.session.findMany({ where, orderBy: { [sortBy]: sortDir }, ...toSkipTake(page, pageSize) }),
    prismaWithoutTenantScoping.session.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prismaWithoutTenantScoping.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/** Used by password reset (FR-220) to invalidate other active sessions on credential change. */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prismaWithoutTenantScoping.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

// --- REST surface (Phase 2 round: sessions over /api/v1) ---
//
// Session is deliberately NOT in tenant-scoping.ts's TENANT_SCOPED_MODELS —
// it's a user-owned record, not an org-owned one (see the model comment in
// schema.prisma). An API key, however, is an organization-level credential
// with no "calling user" behind it (ApiKey has no userId — see its own
// schema comment: "an API key has no User/UserRole to resolve permissions
// through"), so "list/revoke MY session" has no meaning over REST the way it
// does for a cookie-authenticated Tenant Admin user. What an org's API key
// *can* legitimately see/manage is which sessions are currently active
// *within its own organization* (Session.organizationId — the org a session
// is currently switched into, FR-105) — these two functions expose exactly
// that, org-scoped by construction rather than trusting a bare id (same
// updateMany-with-organizationId-in-the-where-clause pattern as
// revokeApiKey/removeOrganizationMember).

/** REST: sessions currently active within one organization, optionally narrowed to one member. Cursor-paginated. */
export async function listSessionsForOrganizationPage(
  organizationId: string,
  params: PageParams & { userId?: string } = {},
): Promise<PageResult<Session>> {
  const limit = clampPageLimit(params.limit);
  const rows = await prismaWithoutTenantScoping.session.findMany({
    where: {
      organizationId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(params.userId ? { userId: params.userId } : {}),
    },
    orderBy: { lastUsedAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  return toPageResult(rows, limit);
}

/** REST: revokes a session, but only if it's currently active within the calling organization — a foreign-org or unknown id 404s via SessionNotFoundError rather than silently no-op'ing (FR-104). */
export async function revokeSessionForOrganization(organizationId: string, sessionId: string): Promise<void> {
  const { count } = await prismaWithoutTenantScoping.session.updateMany({
    where: { id: sessionId, organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new SessionNotFoundError(sessionId);
}
