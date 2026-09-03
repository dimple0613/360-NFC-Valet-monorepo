import { createHash, randomBytes } from "node:crypto";
import { prismaWithoutTenantScoping, db } from "./client";
import { runWithTenant } from "./tenant-context";
import { writeAuditLog } from "./audit-log";
import { hashPassword } from "./auth/password";
import { consoleEmailSender, type EmailSender } from "./auth/email-sender";
import { recordResourceUsageEnforced } from "./billing/subscriptions";
import { recordResourceUsage } from "./billing/resource-consumption";
import { RoleNotFoundError, findVisibleRole } from "./roles";
import { sendNotification } from "./notifications/notify";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "./pagination";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "./list-query";

// FR-173/DoD: accepting an invite activates a membership, which is exactly
// the "seat" a subscription's core.seats allocation quotas — enforced here,
// the one place a membership actually transitions to ACTIVE for a brand new
// member. Re-accepting an already-ACTIVE membership (e.g. a stale invite
// link) must not double-count, hence the isNewSeat check below.
//
// Deliberately no `userId` on this call: getResourceUsage/recordResourceUsageWithQuota
// treat a passed userId as a *scope* on the quota check (right for a per-user
// metered resource), not attribution — passing the new member's own userId
// here would check "how many seats has this brand-new user used" (always 0)
// instead of the org's total, silently defeating enforcement.
const SEATS_RESOURCE_KEY = "core.seats";

// FR-122/DoD "invite a user": see the doc comment on OrganizationInvite in
// schema.prisma for why this model sits outside the tenant-scoping extension.

const TOKEN_BYTES = 32;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export class InvalidOrExpiredInviteError extends Error {
  constructor() {
    super("This invite link is invalid, has expired, or has already been used.");
    this.name = "InvalidOrExpiredInviteError";
  }
}

export class AlreadyMemberError extends Error {
  constructor(email: string) {
    super(`${email} is already a member of this organization.`);
    this.name = "AlreadyMemberError";
  }
}

export class InviteAlreadyPendingError extends Error {
  constructor(email: string) {
    super(`${email} already has a pending invite to this organization.`);
    this.name = "InviteAlreadyPendingError";
  }
}

export class InviteNotFoundError extends Error {
  constructor(inviteId: string) {
    super(`No pending invite with id ${inviteId}.`);
    this.name = "InviteNotFoundError";
  }
}

export interface InviteUserInput {
  organizationId: string;
  email: string;
  roleId?: string;
  invitedByUserId?: string;
}

export async function inviteUserToOrganization(
  input: InviteUserInput,
  emailSender: EmailSender = consoleEmailSender,
): Promise<{ inviteId: string; rawToken: string }> {
  const existingUser = await prismaWithoutTenantScoping.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const membership = await prismaWithoutTenantScoping.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: existingUser.id } },
    });
    if (membership?.status === "ACTIVE") throw new AlreadyMemberError(input.email);
  }

  const pendingInvite = await prismaWithoutTenantScoping.organizationInvite.findFirst({
    where: { organizationId: input.organizationId, email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pendingInvite) throw new InviteAlreadyPendingError(input.email);

  if (input.roleId) {
    // Reject up front rather than letting a foreign-org roleId slip into the
    // invite: without this, acceptOrganizationInvite would create a UserRole
    // whose role belongs to another org — inert for real authorization
    // (userHasOrganizationPermission/getUserOrganizationPermissions both
    // filter by role.organizationId) but a dangling, confusing row otherwise.
    // findVisibleRole also admits global roles (organizationId null).
    const role = await findVisibleRole(input.organizationId, input.roleId);
    if (!role) throw new RoleNotFoundError(input.roleId);
  }

  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const invite = await prismaWithoutTenantScoping.organizationInvite.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      roleId: input.roleId,
      invitedByUserId: input.invitedByUserId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  await runWithTenant(input.organizationId, async () => {
    await writeAuditLog({
      module: "core",
      action: "organization.member_invited",
      actorUserId: input.invitedByUserId,
      resourceType: "OrganizationInvite",
      resourceId: invite.id,
      metadata: { email: input.email },
    });
  });

  await emailSender.send({
    to: input.email,
    subject: "You've been invited to join an organization",
    body: `Your invite token: ${rawToken}`,
  });

  // §2.14 framework proof: the org.invite_sent kind fires through whatever
  // channels are registered/configured — deliberately `only: ["webhook",
  // "in-app"]`, NOT "email": the raw-token email above already covers email
  // delivery for invites (a pre-existing, unrelated code path — see this
  // function's own emailSender param), so including "email" here would send
  // the invitee two emails once the SMTP channel is configured. Best-effort:
  // wrapped so a notification-dispatch problem (a channel misbehaving, or —
  // in an environment that hasn't run the seed script yet — the kind not
  // being registered) never fails the invite itself, which has already
  // fully succeeded by this point.
  try {
    await sendNotification({
      kind: "org.invite_sent",
      organizationId: input.organizationId,
      userId: existingUser?.id,
      email: input.email,
      variables: { organizationName: (await prismaWithoutTenantScoping.organization.findUnique({ where: { id: input.organizationId } }))?.name ?? "an organization" },
      only: ["webhook", "in-app"],
    });
  } catch {
    // Non-fatal — see comment above.
  }

  return { inviteId: invite.id, rawToken };
}

export interface AcceptInviteInput {
  rawToken: string;
  name?: string;
  password: string;
}

/**
 * The password-independent half of accepting an invite: activates the
 * membership, applies the pre-assigned role, records the seat, audits, and
 * marks the invite accepted. Factored out so both the password-based
 * `acceptOrganizationInvite` below and the OAuth sign-in path (which
 * authenticates the user a different way and has no password to set) share
 * one tested implementation instead of two copies of this logic drifting
 * apart.
 */
async function activateAcceptedInvite(
  invite: { id: string; organizationId: string; roleId: string | null },
  userId: string,
): Promise<void> {
  const existingMembership = await prismaWithoutTenantScoping.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
  });
  const isNewSeat = !existingMembership || existingMembership.status !== "ACTIVE";

  if (isNewSeat) {
    await recordResourceUsageEnforced({
      organizationId: invite.organizationId,
      resourceTypeKey: SEATS_RESOURCE_KEY,
      amount: 1,
    });
  }

  await runWithTenant(invite.organizationId, async () => {
    await db.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
      create: { organizationId: invite.organizationId, userId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    if (invite.roleId) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId, roleId: invite.roleId } },
        create: { userId, roleId: invite.roleId, organizationId: invite.organizationId },
        update: {},
      });
    }
    await writeAuditLog({
      module: "core",
      action: "organization.invite_accepted",
      actorUserId: userId,
      resourceType: "OrganizationInvite",
      resourceId: invite.id,
    });
  });

  await prismaWithoutTenantScoping.organizationInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
}

/** Finds a live (unaccepted, unexpired) invite by raw token, or throws. Shared lookup for both acceptance paths. */
async function findLiveInviteByToken(rawToken: string) {
  const invite = await prismaWithoutTenantScoping.organizationInvite.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!invite || invite.acceptedAt !== null || invite.expiresAt.getTime() < Date.now()) {
    throw new InvalidOrExpiredInviteError();
  }
  return invite;
}

/**
 * Finds or reuses the invited user's account, sets their password if they
 * didn't already have one (an existing user can accept an invite to a second
 * org without disturbing their existing credential), activates their
 * membership, and applies the invite's pre-assigned role, if any.
 */
export async function acceptOrganizationInvite(
  input: AcceptInviteInput,
): Promise<{ userId: string; organizationId: string }> {
  const invite = await findLiveInviteByToken(input.rawToken);

  let user = await prismaWithoutTenantScoping.user.findUnique({ where: { email: invite.email } });
  const passwordHash = await hashPassword(input.password);
  if (!user) {
    user = await prismaWithoutTenantScoping.user.create({
      data: { email: invite.email, name: input.name, passwordHash, emailVerifiedAt: new Date() },
    });
  } else if (!user.passwordHash) {
    user = await prismaWithoutTenantScoping.user.update({
      where: { id: user.id },
      data: { passwordHash, name: input.name ?? user.name, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
  }

  await activateAcceptedInvite(invite, user.id);

  return { userId: user.id, organizationId: invite.organizationId };
}

/**
 * OAuth sign-in variant: no raw token, so the invite is found by email
 * instead — the user already authenticated via the OAuth provider itself,
 * there's no password to set. Returns null if there's no pending invite for
 * this email (not an error — a brand-new OAuth user with no invite is the
 * normal "create your own org" case, handled by the caller).
 */
export async function acceptPendingInviteForOAuthUser(
  email: string,
  userId: string,
): Promise<{ organizationId: string } | null> {
  const invite = await prismaWithoutTenantScoping.organizationInvite.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!invite) return null;

  await activateAcceptedInvite(invite, userId);
  return { organizationId: invite.organizationId };
}

/** Tenant Admin UI: pending invites for one org. Filters by organizationId explicitly — this model isn't in the automatic scoping extension (see schema.prisma). */
export async function listPendingInvites(organizationId: string) {
  return prismaWithoutTenantScoping.organizationInvite.findMany({
    where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

const INVITE_SORT_FIELDS = ["createdAt", "email", "expiresAt"] as const;

/** Offset-paginated, searchable, sortable variant for the DataTable UI. */
export async function listPendingInvitesSearch(
  organizationId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<Awaited<ReturnType<typeof listPendingInvites>>[number]>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = INVITE_SORT_FIELDS.includes(params.sortBy as (typeof INVITE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof INVITE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    organizationId,
    acceptedAt: null,
    expiresAt: { gt: new Date() },
    ...(params.q ? { email: { contains: params.q, mode: "insensitive" as const } } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.organizationInvite.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.organizationInvite.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function revokeInvite(inviteId: string): Promise<void> {
  // Deleting rather than marking revoked: an unaccepted invite carries no
  // history worth preserving the way a Session/AuditLog does.
  await prismaWithoutTenantScoping.organizationInvite.delete({ where: { id: inviteId } });
}

/** Cursor-paginated variant of listPendingInvites, for REST — the UI's listPendingInvites/listPendingInvitesSearch stay as-is (unpaginated/offset-paginated, fine at UI scale). */
export async function listPendingInvitesPage(
  organizationId: string,
  params: PageParams = {},
): Promise<PageResult<Awaited<ReturnType<typeof listPendingInvites>>[number]>> {
  const limit = clampPageLimit(params.limit);
  const rows = await prismaWithoutTenantScoping.organizationInvite.findMany({
    where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  return toPageResult(rows, limit);
}

/**
 * REST-safe variant of revokeInvite: only cancels the invite if it actually
 * belongs to the calling organization — a bare inviteId is otherwise
 * globally unique (tokenHash-keyed), so without this an API key could cancel
 * another org's invite by guessing/leaking its id. Same
 * deleteMany-with-organizationId-in-the-where-clause pattern as
 * revokeApiKey/removeOrganizationMember (the "unscoped-id trust" fix this
 * codebase has already applied twice). The pre-existing revokeInvite is left
 * untouched — its one caller (Tenant Admin UI) only ever hands it an id
 * already scoped to the signed-in org's own invite list.
 */
export async function cancelInvite(organizationId: string, inviteId: string): Promise<void> {
  const { count } = await prismaWithoutTenantScoping.organizationInvite.deleteMany({
    where: { id: inviteId, organizationId, acceptedAt: null },
  });
  if (count === 0) throw new InviteNotFoundError(inviteId);
}

/** Just the count — for dashboard stat tiles that only need a number, not every member row (listOrganizationMembers would fetch and include the full User relation for each just to be .length'd, wasteful at scale). */
export async function countActiveOrganizationMembers(organizationId: string): Promise<number> {
  return runWithTenant(organizationId, async () => db.organizationMembership.count({ where: { status: "ACTIVE" } }));
}

/** Tenant Admin UI / REST: an org's member roster with the underlying User attached. */
export async function listOrganizationMembers(organizationId: string) {
  return runWithTenant(organizationId, async () =>
    db.organizationMembership.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
  );
}

/** Cursor-paginated variant for REST — the UI's listOrganizationMembers stays as-is (unpaginated, fine at UI scale). */
export async function listOrganizationMembersPage(
  organizationId: string,
  params: PageParams = {},
): Promise<PageResult<Awaited<ReturnType<typeof listOrganizationMembers>>[number]>> {
  const limit = clampPageLimit(params.limit);
  return runWithTenant(organizationId, async () => {
    const rows = await db.organizationMembership.findMany({
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    return toPageResult(rows, limit);
  });
}

const MEMBER_SORT_FIELDS = ["createdAt", "status", "email", "name"] as const;

/** Offset-paginated, searchable, sortable variant for the DataTable UI — see list-query.ts's doc comment for why this is a separate shape from the cursor-based *Page variant above. */
export async function listOrganizationMembersSearch(
  organizationId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<Awaited<ReturnType<typeof listOrganizationMembers>>[number]>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = MEMBER_SORT_FIELDS.includes(params.sortBy as (typeof MEMBER_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof MEMBER_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "asc";
  const membershipStatuses = ["INVITED", "ACTIVE", "SUSPENDED"] as const;
  const status = params.status && (membershipStatuses as readonly string[]).includes(params.status)
    ? (params.status as (typeof membershipStatuses)[number])
    : undefined;
  const userWhere: { email?: { contains: string; mode: "insensitive" }; userRoles?: { some: { organizationId: string; roleId: string } } } = params.q
    ? { email: { contains: params.q, mode: "insensitive" as const } }
    : {};
  if (params.roleId) {
    userWhere.userRoles = { some: { organizationId, roleId: params.roleId } };
  }
  const where = { ...(status ? { status } : {}), user: userWhere };
  const orderBy =
    sortBy === "email"
      ? ({ user: { email: sortDir } } as const)
      : sortBy === "name"
        ? ({ user: { name: sortDir } } as const)
        : ({ [sortBy]: sortDir } as const);

  return runWithTenant(organizationId, async () => {
    const [items, totalCount] = await Promise.all([
      db.organizationMembership.findMany({ where, include: { user: true }, orderBy, ...toSkipTake(page, pageSize) }),
      db.organizationMembership.count({ where }),
    ]);
    return toListQueryResult(items, totalCount, page, pageSize);
  });
}

export class MembershipNotFoundError extends Error {
  constructor(membershipId: string) {
    super(`No membership with id ${membershipId}.`);
    this.name = "MembershipNotFoundError";
  }
}

/**
 * Removes a member and frees the seat their membership held (core.seats is a
 * GAUGE — mirror image of the +1 recorded when the membership became ACTIVE
 * in acceptOrganizationInvite, so usage stays accurate for the org's next
 * quota check). No `userId` on the usage record: it's an org-wide gauge, not
 * a per-user metric — see the matching note above on acceptOrganizationInvite.
 */
export async function removeOrganizationMember(organizationId: string, membershipId: string): Promise<void> {
  await runWithTenant(organizationId, async () => {
    const { count } = await db.organizationMembership.deleteMany({ where: { id: membershipId } });
    if (count === 0) throw new MembershipNotFoundError(membershipId);
  });
  await recordResourceUsage({ organizationId, resourceTypeKey: SEATS_RESOURCE_KEY, amount: -1 });
}
