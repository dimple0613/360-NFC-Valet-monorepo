import Link from "next/link";
import { PlusIcon, ShieldIcon } from "lucide-react";
import { listGlobalRolesSearch } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { RoleTableRow } from "./role-row";

/**
 * Global roles — Super Admin-managed role templates usable by every
 * organization (distinct from each org's own custom roles, which stay
 * Tenant Admin's to create/edit at tenant-admin/settings/roles). Real CRUD,
 * not view-only: creating/editing here immediately affects every member
 * across every org currently assigned to the role, same live-effect
 * semantics as editing a custom role's permissions already has.
 */
export default async function GlobalRolesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_global_roles");
  const listParams = parseListQueryParams(await searchParams);
  const roles = await listGlobalRolesSearch(listParams);

  const membershipFilter: DataTableFilter = {
    name: "hasMembers",
    value: listParams.hasMembers === undefined ? "" : listParams.hasMembers ? "true" : "false",
    label: "Users",
    allLabel: "All users",
    options: [
      { value: "true", label: "With users" },
      { value: "false", label: "No users" },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldIcon className="size-5" />}
        title="Roles"
        description="Global role templates. Edits apply live to assigned members."
        actions={
          <Link
            href="/super-admin/roles/new"
            className="inline-flex items-center gap-2"
            style={{
              background: "#f4531f",
              color: "#fff",
              borderRadius: 99,
              padding: "10px 20px",
              fontSize: 12.5,
              fontWeight: 800,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
              transition: "background 0.15s ease",
            }}
          >
            <PlusIcon className="size-4" />
            Add role
          </Link>
        }
      />

      <DataTable
        headers={[
          { key: "name", label: "Role", sortable: true },
          { key: "permissions", label: "Permissions", sortable: true },
          { key: "members", label: "Users", sortable: true },
          { key: "updatedAt", label: "Updated at", sortable: true },
          { key: "status", label: "Status" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={roles.page}
        pageSize={roles.pageSize}
        totalCount={roles.totalCount}
        totalPages={roles.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search roles..."
        filters={[membershipFilter]}
      >
        {roles.items.map((role) => (
          <RoleTableRow key={role.id} role={role} />
        ))}
        {roles.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-[#9aa6bc]">
              No roles yet.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
