import { db, prismaWithoutTenantScoping } from "./client";
import { runWithTenant } from "./tenant-context";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "./list-query";
import type { Prisma } from "../generated/client";

// FR-153: authorization enforced server-side via policies, with UI visibility
// derived from the SAME permission data — getUserOrganizationPermissions below
// is that shared source; there is no separate, divergent UI-only check.
//
// No Next.js route wiring yet (unlike tenant-context's withApiTenantContext):
// enforcing this needs a trusted "current user id", which doesn't exist until
// Phase 1B auth/sessions land. Unlike tenant scope (where a client-supplied
// header is an acceptable placeholder), faking *identity* via a client header
// specifically for permission checks would normalize an actually-insecure
// pattern, so that wiring is deferred rather than stubbed. These functions take
// userId as an explicit, trusted parameter — wire them up once callers have one.

export class ForbiddenError extends Error {
  constructor(permissionKey: string) {
    super(`Missing required permission: ${permissionKey}`);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolves a user's permission keys within one organization, via whatever
 * Roles they hold there. This is the single source both a `requireOrganizationPermission`
 * check and any UI visibility decision should read from.
 */
export async function getUserOrganizationPermissions(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  return runWithTenant(organizationId, async () => {
    // role.organizationId filtered explicitly, not just inferred from the
    // UserRole row's own (extension-enforced) organizationId — same belt-and-
    // braces reasoning as userHasOrganizationPermission below, against a
    // UserRole ever pointing at a Role from another org. The OR admits global
    // roles (organizationId null, Super Admin-managed, usable by every org)
    // alongside this org's own custom roles — never a different org's.
    const userRoles = await db.userRole.findMany({
      where: { userId, role: { OR: [{ organizationId }, { organizationId: null }] } },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const keys = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return [...keys];
  });
}

export async function userHasOrganizationPermission(
  userId: string,
  organizationId: string,
  permissionKey: string,
): Promise<boolean> {
  return runWithTenant(organizationId, async () => {
    // role.organizationId is checked explicitly, not just inferred from the
    // UserRole row's own (extension-enforced) organizationId — belt and
    // braces against a UserRole ever pointing at a Role from another org. The
    // OR admits global roles (organizationId null) alongside this org's own.
    const count = await db.userRole.count({
      where: {
        userId,
        role: {
          OR: [{ organizationId }, { organizationId: null }],
          permissions: { some: { permission: { key: permissionKey } } },
        },
      },
    });
    return count > 0;
  });
}

/**
 * Throws ForbiddenError unless the user holds `permissionKey` in `organizationId`
 * AND `condition` (if given) passes. `condition` is the FR-154 ABAC hook — pass a
 * closure over whatever resource-specific attributes matter (ownership, workspace
 * membership, etc.); it only runs after the base permission check succeeds.
 */
export async function requireOrganizationPermission(params: {
  userId: string;
  organizationId: string;
  permissionKey: string;
  condition?: () => boolean | Promise<boolean>;
}): Promise<void> {
  const allowed = await userHasOrganizationPermission(
    params.userId,
    params.organizationId,
    params.permissionKey,
  );
  if (!allowed) throw new ForbiddenError(params.permissionKey);
  if (params.condition && !(await params.condition())) {
    throw new ForbiddenError(params.permissionKey);
  }
}

// --- Platform RBAC equivalents (FR-113: entirely separate role system, no org scope) ---

export async function getUserPlatformPermissions(userId: string): Promise<string[]> {
  const platformUserRoles = await prismaWithoutTenantScoping.platformUserRole.findMany({
    where: { userId },
    include: { platformRole: { include: { permissions: { include: { permission: true } } } } },
  });
  const keys = new Set<string>();
  for (const platformUserRole of platformUserRoles) {
    for (const rolePermission of platformUserRole.platformRole.permissions) {
      keys.add(rolePermission.permission.key);
    }
  }
  return [...keys];
}

export async function userHasPlatformPermission(userId: string, permissionKey: string): Promise<boolean> {
  const count = await prismaWithoutTenantScoping.platformUserRole.count({
    where: { userId, platformRole: { permissions: { some: { permission: { key: permissionKey } } } } },
  });
  return count > 0;
}

export async function requirePlatformPermission(params: {
  userId: string;
  permissionKey: string;
  condition?: () => boolean | Promise<boolean>;
}): Promise<void> {
  const allowed = await userHasPlatformPermission(params.userId, params.permissionKey);
  if (!allowed) throw new ForbiddenError(params.permissionKey);
  if (params.condition && !(await params.condition())) {
    throw new ForbiddenError(params.permissionKey);
  }
}

export interface PlatformAdminRow {
  id: string;
  userEmail: string;
  platformRoleName: string;
  createdAt: Date;
}

/** Super Admin platform-admins list: offset-paginated, searchable (email/role name), sortable by grant date. */
export async function listPlatformAdminsSearch(params: ListQueryParams = {}): Promise<ListQueryResult<PlatformAdminRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const PLATFORM_ADMIN_SORT_FIELDS = ["email", "role", "createdAt"] as const;
  const sortBy = PLATFORM_ADMIN_SORT_FIELDS.includes(params.sortBy as (typeof PLATFORM_ADMIN_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof PLATFORM_ADMIN_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "asc";
  const where = params.q
    ? {
        OR: [
          { user: { email: { contains: params.q, mode: "insensitive" as const } } },
          { platformRole: { name: { contains: params.q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const orderBy: Prisma.PlatformUserRoleOrderByWithRelationInput[] =
    sortBy === "email"
      ? [{ user: { email: sortDir } }, { createdAt: "asc" }]
      : sortBy === "role"
        ? [{ platformRole: { name: sortDir } }, { createdAt: "asc" }]
        : [{ createdAt: sortDir }];

  const [assignments, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.platformUserRole.findMany({
      where,
      include: { user: true, platformRole: true },
      orderBy,
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.platformUserRole.count({ where }),
  ]);

  const items: PlatformAdminRow[] = assignments.map((a) => ({
    id: a.id,
    userEmail: a.user.email,
    platformRoleName: a.platformRole.name,
    createdAt: a.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}
