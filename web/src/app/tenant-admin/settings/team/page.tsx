import Link from "next/link";
import { getUserOrganizationPermissions, listOrganizationMembersSearch, listPendingInvitesSearch, listRolesVisibleToOrganization } from "@saasclaude/db";
import { UsersIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatDate } from "@/lib/format";
import { StatusBadge, MEMBERSHIP_STATUS_STYLES } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { InviteMemberDialog } from "./invite-member-dialog";
import { RemoveMemberButton } from "./remove-member-button";
import { RevokeInviteButton } from "./revoke-invite-button";

const MANAGE_MEMBERS_PERMISSION = "core.organization.manage_members";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId!;
  const rawParams = await searchParams;
  const tab = rawParams.tab === "invites" ? "invites" : "members";
  const memberParams = parseListQueryParams(rawParams, "m_");
  const inviteParams = parseListQueryParams(rawParams, "i_");

  const tabHref = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    if (target === "members") params.delete("tab");
    else params.set("tab", target);
    const qs = params.toString();
    return `/tenant-admin/settings/team${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { value: "members", label: "Members" },
    { value: "invites", label: "Pending invites" },
  ];

  const [members, visibleRoles, pendingInvites, permissions] = await Promise.all([
    listOrganizationMembersSearch(organizationId, memberParams),
    listRolesVisibleToOrganization(organizationId),
    listPendingInvitesSearch(organizationId, inviteParams),
    getUserOrganizationPermissions(identity.user.id, organizationId),
  ]);
  const roles = visibleRoles.map((r) => ({ id: r.id, name: r.scope === "GLOBAL" ? `${r.name} (Global)` : r.name }));
  const canManageMembers = permissions.includes(MANAGE_MEMBERS_PERMISSION);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<UsersIcon className="size-5" />}
        title="Team"
        description="Members, roles, and pending invites for this organization."
        actions={canManageMembers ? <InviteMemberDialog roles={roles} /> : null}
      />

      <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
        {tabs.map(({ value, label }) => {
          const active = tab === value;
          return (
            <Link
              key={value}
              href={tabHref(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "members" ? (
        <DataTable
          headers={[
            { key: "email", label: "Email", sortable: true },
            { key: "status", label: "Status", sortable: true },
            { key: "createdAt", label: "Joined", sortable: true, className: "text-muted-foreground" },
            ...(canManageMembers ? [{ key: "actions", label: "" }] : []),
          ]}
          page={members.page}
          totalCount={members.totalCount}
          totalPages={members.totalPages}
          sortBy={memberParams.sortBy ?? "createdAt"}
          sortDir={memberParams.sortDir ?? "asc"}
          paramPrefix="m_"
          searchPlaceholder="Search by email..."
        >
          {members.items.map((membership) => (
            <TableRow key={membership.id}>
              <TableCell>{membership.user.email}</TableCell>
              <TableCell>
                <StatusBadge value={membership.status} styles={MEMBERSHIP_STATUS_STYLES} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(membership.createdAt)}
              </TableCell>
              {canManageMembers ? (
                <TableCell>
                  <RemoveMemberButton
                    membershipId={membership.id}
                    email={membership.user.email}
                    isSelf={membership.userId === identity.user.id}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {members.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManageMembers ? 4 : 3} className="text-center text-muted-foreground">
                No members found.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}

      {tab === "invites" ? (
        <DataTable
          headers={[
            { key: "email", label: "Email", sortable: true },
            { key: "expiresAt", label: "Expires", sortable: true, className: "text-muted-foreground" },
            ...(canManageMembers ? [{ key: "actions", label: "" }] : []),
          ]}
          page={pendingInvites.page}
          totalCount={pendingInvites.totalCount}
          totalPages={pendingInvites.totalPages}
          sortBy={inviteParams.sortBy ?? "createdAt"}
          sortDir={inviteParams.sortDir ?? "desc"}
          paramPrefix="i_"
          searchPlaceholder="Search by email..."
        >
          {pendingInvites.items.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell>{invite.email}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(invite.expiresAt)}</TableCell>
              {canManageMembers ? (
                <TableCell>
                  <RevokeInviteButton inviteId={invite.id} email={invite.email} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {pendingInvites.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManageMembers ? 3 : 2} className="text-center text-muted-foreground">
                No pending invites.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
    </div>
  );
}
