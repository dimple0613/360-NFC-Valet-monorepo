import { listPlatformAdminsSearch, prismaWithoutTenantScoping } from "@saasclaude/db";
import { ShieldCheckIcon } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { AssignAdminDialog } from "./assign-admin-dialog";
import { RevokeAdminButton } from "./revoke-admin-button";

export default async function PlatformAdminsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_platform_admins");
  const listParams = parseListQueryParams(await searchParams);
  const [assignments, roles] = await Promise.all([
    listPlatformAdminsSearch(listParams),
    prismaWithoutTenantScoping.platformRole.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldCheckIcon className="size-5" />}
        title="Platform Admins"
        description="Platform-level staff who can operate the super-admin portal, scoped by platform role."
        actions={<AssignAdminDialog roles={roles.map((r) => ({ id: r.id, name: r.name }))} />}
      />

      <DataTable
        headers={[
          { key: "email", label: "Email", sortable: true },
          { key: "role", label: "Role", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={assignments.page}
        totalCount={assignments.totalCount}
        totalPages={assignments.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "asc"}
        searchPlaceholder="Search by email or role..."
      >
        {assignments.items.map((assignment) => (
          <tr key={assignment.id} className="border-b border-[#f1f3f6] last:border-b-0 hover:bg-[#fafbfc] transition-colors">
            <td className="px-4 py-3 text-[13px] font-bold text-[#1c2b46]">{assignment.userEmail}</td>
            <td className="px-4 py-3 text-[13px] font-medium text-[#6c7a93]">{assignment.platformRoleName}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end">
                <RevokeAdminButton
                  platformUserRoleId={assignment.id}
                  userEmail={assignment.userEmail}
                />
              </div>
            </td>
          </tr>
        ))}
        {assignments.items.length === 0 ? (
          <tr>
            <td colSpan={3} className="px-4 py-6 text-center text-[13px] text-[#9aa6bc]">
              No platform admins found.
            </td>
          </tr>
        ) : null}
      </DataTable>
    </div>
  );
}