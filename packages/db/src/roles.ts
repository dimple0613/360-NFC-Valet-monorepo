import type { Role } from "../generated/client";
import type { Prisma } from "../generated/client";
import { db, prismaWithoutTenantScoping } from "./client";
import { runWithTenant } from "./tenant-context";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "./pagination";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "./list-query";

// FR-122's custom role builder, as a real service — extracted from what was
// previously inline Prisma calls in web/src/app/tenant-admin/settings/roles/actions.ts
// so the same tested logic can back both the Tenant Admin UI's Server Actions
// and the /api/v1/roles REST routes (Phase 2 "full API surface"), rather than
// two independently-maintained copies of the same business logic.

export class RoleNotFoundError extends Error {
  constructor(roleId: string) {
    super(`No role with id ${roleId}.`);
    this.name = "RoleNotFoundError";
  }
}

export class UserNotAMemberError extends Error {
  constructor(userId: string) {
    super(`User ${userId} is not an active member of this organization.`);
    this.name = "UserNotAMemberError";
  }
}

export class UserRoleNotFoundError extends Error {
  constructor(roleId: string, userId: string) {
    super(`Role ${roleId} is not assigned to user ${userId}.`);
    this.name = "UserRoleNotFoundError";
  }
}

/** The built-in "owner" role (created for every org at signup, holding every TENANT permission) is immutable — see OWNER_ROLE_SLUG's call sites for exactly what that means. */
export class OwnerRoleImmutableError extends Error {
  constructor() {
    super("The Owner role can't be edited or deleted.");
    this.name = "OwnerRoleImmutableError";
  }
}

/** Guards against an org being left with zero Owners — a real gap flagged (not fixed) back in the Phase 1A notes: nothing previously stopped removing the last person holding the Owner role. */
export class LastOwnerError extends Error {
  constructor() {
    super("Can't remove the last Owner — assign Owner to someone else first.");
    this.name = "LastOwnerError";
  }
}

export const OWNER_ROLE_SLUG = "owner";

/**
 * FR-122's default role set, seeded once per org at signup. Tiered using only
 * permissions that actually exist in the TENANT catalog today — Admin gets
 * everything except core.roles.manage (can run the org day-to-day but can't
 * grant itself, or anyone else, more power by editing roles/permissions);
 * Member gets read access to the org and its people; Viewer gets just enough
 * to know the org exists. `null` permissionKeys means "every registered
 * TENANT permission" (Owner only) rather than an explicit, staler list.
 */
const DEFAULT_ROLE_DEFINITIONS: {
  name: string;
  description: string;
  permissionKeys: string[] | null;
  excludeKeys?: string[];
}[] = [
  { name: "Owner", description: "Full access to this organization.", permissionKeys: null },
  {
    name: "Admin",
    description: "Manages the organization day-to-day, but can't change roles or permissions.",
    permissionKeys: null,
    excludeKeys: ["core.roles.manage"],
  },
  {
    name: "Member",
    description: "Can view the organization and its team.",
    permissionKeys: ["core.organization.read", "core.organization.read_members"],
  },
  {
    name: "Viewer",
    description: "Read-only access to the organization.",
    permissionKeys: ["core.organization.read"],
  },
];

/** Seeds the default role set for a brand-new org. Returns the Owner role's id so the caller can assign the founding member to it. */
export async function seedDefaultRoles(organizationId: string): Promise<{ ownerRoleId: string }> {
  const tenantPermissions = await prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" } });
  const permissionIdByKey = new Map(tenantPermissions.map((p) => [p.key, p.id]));

  let ownerRoleId: string | null = null;
  await runWithTenant(organizationId, async () => {
    for (const definition of DEFAULT_ROLE_DEFINITIONS) {
      const role = await db.role.create({
        data: {
          organizationId,
          name: definition.name,
          slug: slugify(definition.name),
          description: definition.description,
        },
      });
      if (definition.name === "Owner") ownerRoleId = role.id;

      const keys = definition.permissionKeys ?? [...permissionIdByKey.keys()];
      const excluded = new Set(definition.excludeKeys ?? []);
      // One batched insert instead of an N-await loop — besides being the
      // obviously faster shape, this also shrinks (doesn't eliminate) the
      // window for the pre-existing cross-test Permission-row race documented
      // in TASKS.md: the old sequential-create version of this function did
      // ~10 awaits per org; seeding 4 roles instead of 1 had pushed that to
      // ~30+, which is what made the race start reproducing on nearly every
      // full-suite run instead of "occasionally."
      const rolePermissionData = keys
        .filter((key) => !excluded.has(key))
        .map((key) => permissionIdByKey.get(key))
        .filter((permissionId): permissionId is string => permissionId !== undefined) // catalog doesn't have this key (yet) - skip rather than fail seeding
        .map((permissionId) => ({ roleId: role.id, permissionId, organizationId }));
      if (rolePermissionData.length > 0) {
        await db.rolePermission.createMany({ data: rolePermissionData });
      }
    }
  });

  if (!ownerRoleId) throw new Error("seedDefaultRoles: Owner role was not created.");
  return { ownerRoleId };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listRoles(organizationId: string): Promise<Role[]> {
  return runWithTenant(organizationId, async () => db.role.findMany({ orderBy: { name: "asc" } }));
}

/**
 * A role visible to this org — its own custom role, OR any global role
 * (organizationId null). Deliberately bypasses the tenant-scoped `db` client:
 * that client forces `organizationId = <current tenant>` equality on every
 * read (see tenant-scoping.ts's withOrgFilter), which can never match a
 * global role's null organizationId no matter what `where` is passed. This
 * is the ONLY place that check is written — assignRoleToUser,
 * unassignRoleFromUser, setRolePermissions, and inviteUserToOrganization's
 * roleId validation all call this instead of querying Role directly, so the
 * "org-owned OR global, never a different org's custom role" rule lives in
 * one reviewed spot rather than being re-derived at every call site.
 */
export async function findVisibleRole(organizationId: string, roleId: string): Promise<Role | null> {
  const role = await prismaWithoutTenantScoping.role.findUnique({ where: { id: roleId } });
  if (!role) return null;
  if (role.organizationId !== null && role.organizationId !== organizationId) return null;
  return role;
}

export interface VisibleRoleRow {
  id: string;
  name: string;
  scope: "GLOBAL" | "CUSTOM";
}

/** This org's own custom roles plus every global role, combined — the role-picker list for "assign a role to a member," wherever that happens (Super Admin's Add/Edit User forms, Tenant Admin's invite form). */
export async function listRolesVisibleToOrganization(organizationId: string): Promise<VisibleRoleRow[]> {
  const [customRoles, globalRoles] = await Promise.all([listRoles(organizationId), listGlobalRoles()]);
  return [
    ...globalRoles.map((r) => ({ id: r.id, name: r.name, scope: "GLOBAL" as const })),
    ...customRoles.map((r) => ({ id: r.id, name: r.name, scope: "CUSTOM" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

// --- Global roles (Super Admin-managed, usable by every org) ---

export interface GlobalRoleRow {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number;
  memberCount: number;
  updatedAt: Date;
  createdAt: Date;
}

const GLOBAL_ROLE_SORT_FIELDS = ["name", "permissions", "members", "createdAt", "updatedAt"] as const;

export async function listGlobalRolesSearch(params: ListQueryParams = {}): Promise<ListQueryResult<GlobalRoleRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = GLOBAL_ROLE_SORT_FIELDS.includes(params.sortBy as (typeof GLOBAL_ROLE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof GLOBAL_ROLE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "desc";
  const where = {
    organizationId: null,
    ...(params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}),
    ...(params.hasMembers === undefined
      ? {}
      : params.hasMembers
        ? { userRoles: { some: {} } }
        : { userRoles: { none: {} } }),
  };
  const orderBy: Prisma.RoleOrderByWithRelationInput[] =
    sortBy === "permissions"
      ? [{ permissions: { _count: sortDir } }, { createdAt: "desc" }]
      : sortBy === "members"
        ? [{ userRoles: { _count: sortDir } }, { createdAt: "desc" }]
        : [{ [sortBy]: sortDir }, { createdAt: "desc" }];

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.role.findMany({
      where,
      orderBy,
      ...toSkipTake(page, pageSize),
      include: { _count: { select: { permissions: true, userRoles: true } } },
    }),
    prismaWithoutTenantScoping.role.count({ where }),
  ]);

  const items: GlobalRoleRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissionCount: r._count.permissions,
    memberCount: r._count.userRoles,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

async function listGlobalRoles(): Promise<Role[]> {
  return prismaWithoutTenantScoping.role.findMany({ where: { organizationId: null }, orderBy: { name: "asc" } });
}

export class DuplicateGlobalRoleNameError extends Error {
  constructor(name: string) {
    super(`A global role named "${name}" already exists.`);
    this.name = "DuplicateGlobalRoleNameError";
  }
}

export async function createGlobalRole(input: { name: string; description: string }): Promise<Role> {
  const slug = slugify(input.name);
  const existing = await prismaWithoutTenantScoping.role.findFirst({ where: { organizationId: null, slug } });
  if (existing) throw new DuplicateGlobalRoleNameError(input.name);

  return prismaWithoutTenantScoping.role.create({
    data: { organizationId: null, name: input.name, slug, description: input.description },
  });
}

export async function updateGlobalRoleDetails(
  roleId: string,
  input: { name: string; description: string },
): Promise<Role> {
  const role = await prismaWithoutTenantScoping.role.findUnique({ where: { id: roleId } });
  if (!role || role.organizationId !== null) throw new RoleNotFoundError(roleId);

  // Keep the slug in step with the name, and enforce the same uniqueness
  // check createGlobalRole does — otherwise a rename can collide with another
  // role's name while its slug silently stays frozen.
  const slug = slugify(input.name);
  if (slug !== role.slug) {
    const clash = await prismaWithoutTenantScoping.role.findFirst({
      where: { organizationId: null, slug, id: { not: roleId } },
    });
    if (clash) throw new DuplicateGlobalRoleNameError(input.name);
  }

  return prismaWithoutTenantScoping.role.update({
    where: { id: roleId },
    data: { name: input.name, slug, description: input.description },
  });
}

export async function getGlobalRoleWithPermissions(roleId: string): Promise<RoleWithPermissionKeys> {
  const role = await prismaWithoutTenantScoping.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role || role.organizationId !== null) throw new RoleNotFoundError(roleId);
  return { ...role, permissionKeys: role.permissions.map((rp) => rp.permission.key) };
}

/** Replaces a global role's entire permission set — same replace-all semantics as setRolePermissions, but organizationId stays null throughout (no tenant context to run this under). */
export async function setGlobalRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  const role = await prismaWithoutTenantScoping.role.findUnique({ where: { id: roleId } });
  if (!role || role.organizationId !== null) throw new RoleNotFoundError(roleId);

  await prismaWithoutTenantScoping.rolePermission.deleteMany({ where: { roleId } });
  if (permissionIds.length > 0) {
    await prismaWithoutTenantScoping.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId, organizationId: null })),
    });
  }
}

export async function deleteGlobalRole(roleId: string): Promise<void> {
  const role = await prismaWithoutTenantScoping.role.findUnique({ where: { id: roleId } });
  if (!role || role.organizationId !== null) throw new RoleNotFoundError(roleId);

  await prismaWithoutTenantScoping.role.delete({ where: { id: roleId } });
}

/**
 * Batched userId -> role names, for the Users tab row-list (one query for
 * the whole page instead of one per row). A user can hold more than one
 * role — callers join the names for display.
 */
export async function listMemberRoleNames(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const userRoles = await runWithTenant(organizationId, async () =>
    db.userRole.findMany({ where: { userId: { in: userIds } }, include: { role: true } }),
  );
  const byUser = new Map<string, string[]>();
  for (const userRole of userRoles) {
    const names = byUser.get(userRole.userId) ?? [];
    names.push(userRole.role.name);
    byUser.set(userRole.userId, names);
  }
  return byUser;
}

/**
 * Batched userId -> role ids, mirroring listMemberRoleNames but returning the
 * ids so the Users tab's edit dialog can pre-select the member's current role.
 */
export async function listMemberRoleIds(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const userRoles = await runWithTenant(organizationId, async () =>
    db.userRole.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: "asc" } }),
  );
  const byUser = new Map<string, string>();
  for (const userRole of userRoles) {
    if (!byUser.has(userRole.userId)) byUser.set(userRole.userId, userRole.roleId);
  }
  return byUser;
}

/**
 * Swaps a member's role set to exactly one role — the Users tab's edit form
 * has a single Role select, not the multi-role-assignment UI the Roles page
 * has. Every check runs before any mutation, so a bad roleId or a
 * last-Owner violation can't leave the member stripped of roles partway
 * through (there's no interactive transaction on the tenant-scoped client).
 */
export async function setMemberSingleRole(organizationId: string, userId: string, roleId: string): Promise<void> {
  const target = await findVisibleRole(organizationId, roleId);
  if (!target) throw new RoleNotFoundError(roleId);

  const existing = await runWithTenant(organizationId, async () => db.userRole.findMany({ where: { userId } }));
  const toRemove = existing.filter((userRole) => userRole.roleId !== roleId);
  const alreadyAssigned = existing.some((userRole) => userRole.roleId === roleId);

  // Pre-flight the last-Owner guard for the whole batch, so we don't remove
  // some roles and then throw when we reach Owner.
  if (toRemove.length > 0) {
    const wouldOrphanOwner = await runWithTenant(organizationId, async () => {
      const ownerRole = await db.role.findFirst({
        where: { id: { in: toRemove.map((userRole) => userRole.roleId) }, slug: OWNER_ROLE_SLUG },
      });
      if (!ownerRole) return false;
      const ownerAssignments = await db.userRole.count({ where: { roleId: ownerRole.id } });
      return ownerAssignments <= 1;
    });
    if (wouldOrphanOwner) throw new LastOwnerError();
  }

  for (const userRole of toRemove) {
    await unassignRoleFromUser(organizationId, userRole.roleId, userId);
  }
  if (!alreadyAssigned) await assignRoleToUser(organizationId, roleId, userId);
}

/**
 * Resolves who to impersonate for a row-level "Login as" (Super Admin
 * organizations list) with no explicit member picked, unlike the existing
 * per-member impersonateAction on the org detail page. Prefers the org's
 * Owner-role holder; falls back to the earliest-joined active member for the
 * edge case of an org with no active Owner (role reassigned/removed since).
 */
export async function getOrganizationOwnerUserId(organizationId: string): Promise<string | null> {
  return runWithTenant(organizationId, async () => {
    const ownerMembership = await db.organizationMembership.findFirst({
      where: {
        status: "ACTIVE",
        user: { userRoles: { some: { organizationId, role: { slug: OWNER_ROLE_SLUG } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    if (ownerMembership) return ownerMembership.userId;

    const fallback = await db.organizationMembership.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    return fallback?.userId ?? null;
  });
}

/** Cursor-paginated variant for REST — the UI's listRoles stays as-is (unpaginated, fine at UI scale). */
export async function listRolesPage(organizationId: string, params: PageParams = {}): Promise<PageResult<Role>> {
  const limit = clampPageLimit(params.limit);
  return runWithTenant(organizationId, async () => {
    const rows = await db.role.findMany({
      orderBy: { name: "asc" },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    return toPageResult(rows, limit);
  });
}

export interface RoleWithPermissionKeys extends Role {
  permissionKeys: string[];
}

/** Includes the role's granted permission keys — the shape a caller needs to actually know what a role can do. */
export async function getRoleWithPermissions(
  organizationId: string,
  roleId: string,
): Promise<RoleWithPermissionKeys> {
  const role = await runWithTenant(organizationId, async () =>
    db.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    }),
  );
  if (!role) throw new RoleNotFoundError(roleId);
  return {
    ...role,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
  };
}

export async function createRole(organizationId: string, name: string): Promise<Role> {
  return runWithTenant(organizationId, async () =>
    db.role.create({ data: { organizationId, name, slug: slugify(name) } }),
  );
}

export async function deleteRole(organizationId: string, roleId: string): Promise<void> {
  await runWithTenant(organizationId, async () => {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleNotFoundError(roleId);
    if (role.slug === OWNER_ROLE_SLUG) throw new OwnerRoleImmutableError();

    const { count } = await db.role.deleteMany({ where: { id: roleId } });
    if (count === 0) throw new RoleNotFoundError(roleId);
  });
}

/**
 * Grants roleId to userId, idempotently. Validates both under tenant context
 * rather than trusting the ids: roleId must belong to this org (fetched, not
 * just filtered into a create — a create with an unscoped write would happily
 * write a UserRole pointing at a foreign-org role, see the invite-time
 * roleId bug this same pattern fixed in organization-invites.ts), and userId
 * must be an ACTIVE member of this org (assigning a role to a non-member is
 * meaningless — they could never switch a session into an org they don't
 * belong to, but a dangling grant is still a data-integrity smell worth
 * rejecting outright).
 */
export async function assignRoleToUser(organizationId: string, roleId: string, userId: string): Promise<void> {
  const role = await findVisibleRole(organizationId, roleId);
  if (!role) throw new RoleNotFoundError(roleId);

  await runWithTenant(organizationId, async () => {
    const membership = await db.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership || membership.status !== "ACTIVE") throw new UserNotAMemberError(userId);

    await db.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, organizationId },
      update: {},
    });
  });
}

export async function unassignRoleFromUser(organizationId: string, roleId: string, userId: string): Promise<void> {
  await runWithTenant(organizationId, async () => {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (role?.slug === OWNER_ROLE_SLUG) {
      const ownerAssignmentCount = await db.userRole.count({ where: { roleId } });
      if (ownerAssignmentCount <= 1) throw new LastOwnerError();
    }

    const { count } = await db.userRole.deleteMany({ where: { roleId, userId } });
    if (count === 0) throw new UserRoleNotFoundError(roleId, userId);
  });
}

export interface PlatformRoleRow {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  permissionCount: number;
  memberCount: number;
  createdAt: Date;
}

const PLATFORM_ROLE_SORT_FIELDS = ["name", "createdAt"] as const;

/** Super Admin "Customer > Roles" list: every tenant role across every org, searchable by role or org name. */
export async function listAllTenantRolesSearch(params: ListQueryParams = {}): Promise<ListQueryResult<PlatformRoleRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLATFORM_ROLE_SORT_FIELDS.includes(params.sortBy as (typeof PLATFORM_ROLE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof PLATFORM_ROLE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    // Global roles (organizationId null) have no organization and aren't a
    // "tenant role" for this listing's purpose — they get their own
    // Super Admin surface (listGlobalRolesSearch).
    organizationId: { not: null },
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { organization: { name: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.role.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
      include: { organization: { select: { name: true } }, _count: { select: { permissions: true, userRoles: true } } },
    }),
    prismaWithoutTenantScoping.role.count({ where }),
  ]);

  const items: PlatformRoleRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    organizationId: r.organizationId as string,
    organizationName: r.organization?.name ?? "—",
    permissionCount: r._count.permissions,
    memberCount: r._count.userRoles,
    createdAt: r.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

export interface RoleAssigneeRow {
  userRoleId: string;
  userId: string;
  email: string;
}

/** Offset-paginated, searchable (by email) variant of a role's assignee list, for the compact DataTable embedded in each role's card on the Roles page. */
export async function listRoleAssigneesSearch(
  organizationId: string,
  roleId: string,
  params: ListQueryParams = {},
): Promise<ListQueryResult<RoleAssigneeRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const where = {
    roleId,
    ...(params.q ? { user: { email: { contains: params.q, mode: "insensitive" as const } } } : {}),
  };

  return runWithTenant(organizationId, async () => {
    const [rows, totalCount] = await Promise.all([
      db.userRole.findMany({
        where,
        include: { user: true },
        orderBy: { user: { email: params.sortDir ?? "asc" } },
        ...toSkipTake(page, pageSize),
      }),
      db.userRole.count({ where }),
    ]);
    const items: RoleAssigneeRow[] = rows.map((r) => ({ userRoleId: r.id, userId: r.userId, email: r.user.email }));
    return toListQueryResult(items, totalCount, page, pageSize);
  });
}

/** Replaces a role's entire permission set (matches the Tenant Admin UI's checkbox-form semantics: unchecked = removed). */
export async function setRolePermissions(
  organizationId: string,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  await runWithTenant(organizationId, async () => {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleNotFoundError(roleId);
    if (role.slug === OWNER_ROLE_SLUG) throw new OwnerRoleImmutableError();

    await db.rolePermission.deleteMany({ where: { roleId } });
    for (const permissionId of permissionIds) {
      await db.rolePermission.create({ data: { roleId, permissionId, organizationId } });
    }
  });
}
