import Link from "next/link";
import { ShieldIcon } from "lucide-react";
import { db, listRoleAssigneesSearch, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requireIdentity } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CreateRoleDialog } from "./create-role-dialog";
import { RoleDetailPanel } from "./role-detail-panel";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId!;
  const rawParams = await searchParams;

  const [roles, permissionCatalog, members] = await Promise.all([
    runWithTenant(organizationId, async () =>
      db.role.findMany({
        include: {
          permissions: true,
          userRoles: { select: { userId: true } },
        },
        orderBy: { name: "asc" },
      }),
    ),
    prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" }, orderBy: { key: "asc" } }),
    runWithTenant(organizationId, async () => db.organizationMembership.findMany({ include: { user: true } })),
  ]);

  const activeRoleId = typeof rawParams.role === "string" ? rawParams.role : roles[0]?.id;
  const activeRole = roles.find((r) => r.id === activeRoleId) ?? roles[0];

  const tabHref = (roleId: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (key === "role") continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    params.set("role", roleId);
    return `/tenant-admin/settings/roles?${params.toString()}`;
  };

  const renderedPanels = await Promise.all(
    roles.map(async (role) => {
      const grantedPermissionIds = new Set(role.permissions.map((p) => p.permissionId));
      const assignedUserIds = new Set(role.userRoles.map((ur) => ur.userId));
      const assignableMembers = members
        .filter((m) => !assignedUserIds.has(m.userId))
        .map((m) => ({ userId: m.userId, email: m.user.email }));

      const paramPrefix = `role_${role.id}_`;
      const assigneeParams = parseListQueryParams(rawParams, paramPrefix);
      const assignees = await listRoleAssigneesSearch(organizationId, role.id, assigneeParams);

      return {
        role,
        grantedPermissionIds,
        assignableMembers,
        assignees,
        assigneeParams,
        paramPrefix,
      };
    }),
  );

  const active = renderedPanels.find((p) => p.role.id === activeRole?.id) ?? renderedPanels[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldIcon className="size-5" />}
        title="Roles"
        description="Custom roles control what members can access."
        actions={<CreateRoleDialog />}
      />

      <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
        {roles.map((role) => {
          const activeTab = role.id === active?.role.id;
          return (
            <Link
              key={role.id}
              href={tabHref(role.id)}
              aria-current={activeTab ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors",
                activeTab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {role.name}
            </Link>
          );
        })}
      </nav>

      {active ? (
        <RoleDetailPanel
          roleId={active.role.id}
          roleName={active.role.name}
          permissionCatalog={permissionCatalog}
          grantedPermissionIds={active.grantedPermissionIds}
          assignees={active.assignees}
          assigneeSortBy={active.assigneeParams.sortBy ?? "email"}
          assigneeSortDir={active.assigneeParams.sortDir ?? "asc"}
          paramPrefix={active.paramPrefix}
          assignableMembers={active.assignableMembers}
        />
      ) : null}
    </div>
  );
}
