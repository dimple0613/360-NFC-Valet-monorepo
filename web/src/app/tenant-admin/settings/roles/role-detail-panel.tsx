import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { OWNER_ROLE_SLUG, type ListQueryResult, type RoleAssigneeRow } from "@saasclaude/db";
import { assignRoleAction } from "./actions";
import { AddPermissionDialog } from "./add-permission-dialog";
import { UnassignMemberButton } from "./unassign-member-button";

interface RoleDetailPanelProps {
  roleId: string;
  roleName: string;
  permissionCatalog: { id: string; key: string; description: string | null }[];
  grantedPermissionIds: Set<string>;
  assignees: ListQueryResult<RoleAssigneeRow>;
  assigneeSortBy: string;
  assigneeSortDir: "asc" | "desc";
  paramPrefix: string;
  assignableMembers: { userId: string; email: string }[];
}

export function RoleDetailPanel({
  roleId,
  roleName,
  permissionCatalog,
  grantedPermissionIds,
  assignees,
  assigneeSortBy,
  assigneeSortDir,
  paramPrefix,
  assignableMembers,
}: RoleDetailPanelProps) {
  const isOwner = roleName.toLowerCase() === OWNER_ROLE_SLUG;
  const grantedList = permissionCatalog.filter((p) => grantedPermissionIds.has(p.id));
  const assign = assignRoleAction.bind(null, roleId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{roleName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Owner always has every permission and can't be edited or deleted."
                : "Permissions apply instantly to every assigned member."}
            </p>
          </div>
          {!isOwner ? (
            <AddPermissionDialog roleId={roleId} roleName={roleName} catalog={permissionCatalog} selected={grantedPermissionIds} />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[#48566e]">Permissions ({grantedList.length})</span>
            {isOwner ? (
              <span className="text-[12.5px] font-semibold text-[#9aa6bc]">All permissions granted</span>
            ) : null}
          </div>
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              {permissionCatalog.map((p) => (
                <span key={p.id} className="rounded-full border border-[#e7eaf0] bg-[#f9fafb] px-3 py-1 text-[12px] font-semibold text-[#48566e]">
                  {p.key.split(".").slice(2).join(".") || p.key}
                </span>
              ))}
            </div>
          ) : grantedList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {grantedList.map((p) => (
                <span key={p.id} className="rounded-full border border-[#e7eaf0] bg-[#f9fafb] px-3 py-1 text-[12px] font-semibold text-[#48566e]">
                  {p.key.split(".").slice(2).join(".") || p.key}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No permissions granted yet.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[#48566e]">Assigned members ({assignees.totalCount})</span>
          </div>
          <DataTable
            headers={[
              { key: "email", label: "Email", sortable: true },
              { key: "actions", label: "" },
            ]}
            page={assignees.page}
            totalCount={assignees.totalCount}
            totalPages={assignees.totalPages}
            sortBy={assigneeSortBy}
            sortDir={assigneeSortDir}
            paramPrefix={paramPrefix}
            searchPlaceholder="Search by email..."
            rightSlot={
              <>
                {assignableMembers.length > 0 ? (
                  <ActionForm action={assign} successMessage="Member assigned.">
                    <div className="flex items-center gap-2">
                      <Select
                        name="userId"
                        items={assignableMembers.map((m) => ({ value: m.userId, label: m.email }))}
                      >
                        <SelectTrigger className="h-[34px] rounded-full border-[1.5px] border-[#e7eaf0] bg-white px-4 text-[12.5px] font-bold text-[#1c2b46]">
                          <span className="font-semibold text-[#6c7a93]">Assign:</span>
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableMembers.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button type="submit" className="btn-primary">
                        Assign
                      </button>
                    </div>
                  </ActionForm>
                ) : (
                  <span className="text-[12.5px] font-semibold text-[#9aa6bc]">Everyone is assigned</span>
                )}
              </>
            }
          >
            {assignees.items.map((assignee) => (
              <TableRow key={assignee.userRoleId}>
                <TableCell>{assignee.email}</TableCell>
                <TableCell className="text-right">
                  <UnassignMemberButton roleId={roleId} userId={assignee.userId} email={assignee.email} />
                </TableCell>
              </TableRow>
            ))}
            {assignees.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No one yet.
                </TableCell>
              </TableRow>
            ) : null}
          </DataTable>
        </div>
      </CardContent>
    </Card>
  );
}
