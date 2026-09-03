import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2Icon, TriangleAlertIcon } from "lucide-react";
import {
  getUserPlatformPermissions,
  listMemberRoleIds,
  listMemberRoleNames,
  listOrganizationMembersSearch,
  listRolesVisibleToOrganization,
  prismaWithoutTenantScoping,
} from "@saasclaude/db";

import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/action-button";
import { StatusBadge, ORG_STATUS_STYLES } from "@/components/status-badge";
import { parseListQueryParams } from "@/lib/list-query-params";
import { cn } from "@/lib/utils";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OrganizationBillingSection } from "./billing-section";
import { OrganizationProfileForm } from "./profile-form";
import { OrganizationContactForm } from "./contact-form";
import { MemberRow } from "./member-row";
import { AddMemberButton } from "./add-member-button";
import {
  archiveOrganizationAction,
  cancelDeletionAction,
  reactivateOrganizationAction,
  scheduleDeletionAction,
  suspendOrganizationAction,
} from "./actions";

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requirePlatformAccess("core.platform.manage_organizations");
  const { id } = await params;
  const rawParams = await searchParams;
  const organization = await prismaWithoutTenantScoping.organization.findUnique({ where: { id } });
  if (!organization) notFound();

  const memberParams = parseListQueryParams(rawParams, "mem_");
  const [members, permissions, roles] = await Promise.all([
    listOrganizationMembersSearch(id, memberParams),
    getUserPlatformPermissions(identity.session.userId),
    listRolesVisibleToOrganization(id),
  ]);
  const roleNamesByUser = await listMemberRoleNames(
    id,
    members.items.map((m) => m.userId),
  );
  const roleIdsByUser = await listMemberRoleIds(
    id,
    members.items.map((m) => m.userId),
  );
  const canViewBilling = permissions.includes("core.platform.view_billing");
  const memberStatusFilter = {
    name: "status",
    value: memberParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "INVITED", label: "Invited" },
      { value: "ACTIVE", label: "Active" },
      { value: "SUSPENDED", label: "Suspended" },
    ],
  };
  const memberRoleFilter = {
    name: "roleId",
    value: memberParams.roleId ?? "",
    label: "Role",
    allLabel: "All roles",
    options: roles.map((r) => ({ value: r.id, label: r.name })),
  };
  const memberFilters = [memberStatusFilter, memberRoleFilter];

  const tab = rawParams.tab === "contact" || rawParams.tab === "users" || rawParams.tab === "subscriptions" ? rawParams.tab : "profile";

  const tabHref = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    if (target === "profile") params.delete("tab");
    else params.set("tab", target);
    const qs = params.toString();
    return `/super-admin/organizations/${id}${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { value: "profile", label: "Profile" },
    { value: "contact", label: "Contact information" },
    { value: "users", label: "Users" },
    ...(canViewBilling ? [{ value: "subscriptions", label: "Subscriptions" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Building2Icon className="size-5" />}
        title={organization.name}
        description="Manage the profile, contact information, users, and subscriptions for this customer."
        titleTrailing={<StatusBadge value={organization.status} styles={ORG_STATUS_STYLES} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {organization.status === "ACTIVE" ? (
              <ActionButton
                action={suspendOrganizationAction.bind(null, organization.id)}
                successMessage="Organization suspended."
                variant="outline"
                className="h-7 gap-1 rounded-full px-2.5 text-[0.8rem]"
              >
                Suspend
              </ActionButton>
            ) : null}
            {organization.status === "SUSPENDED" ? (
              <ActionButton
                action={reactivateOrganizationAction.bind(null, organization.id)}
                successMessage="Organization reactivated."
                variant="outline"
                className="h-7 gap-1 rounded-full px-2.5 text-[0.8rem]"
              >
                Reactivate
              </ActionButton>
            ) : null}
            {organization.status === "ACTIVE" || organization.status === "SUSPENDED" ? (
              <ActionButton
                action={archiveOrganizationAction.bind(null, organization.id)}
                successMessage="Organization archived."
                confirmMessage={`Archive "${organization.name}"?`}
                confirmLabel="Archive"
                variant="outline"
                className="h-7 gap-1 rounded-full px-2.5 text-[0.8rem]"
              >
                Archive
              </ActionButton>
            ) : null}
            {organization.status !== "PENDING_DELETION" ? (
              <ActionButton
                action={scheduleDeletionAction.bind(null, organization.id)}
                successMessage="Deletion scheduled for 30 days from now."
                confirmMessage={`Schedule "${organization.name}" for deletion in 30 days?`}
                confirmLabel="Schedule deletion"
                variant="destructive"
                className="h-7 gap-1 rounded-full px-2.5 text-[0.8rem]"
              >
                Schedule deletion (30 days)
              </ActionButton>
            ) : (
              <ActionButton
                action={cancelDeletionAction.bind(null, organization.id)}
                successMessage="Scheduled deletion canceled."
                variant="outline"
                className="h-7 gap-1 rounded-full px-2.5 text-[0.8rem]"
              >
                Cancel scheduled deletion
              </ActionButton>
            )}
          </div>
        }
      />
      {organization.deletionScheduledFor ? (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" />
          <span>Scheduled for deletion on {formatDateTime(organization.deletionScheduledFor)}</span>
        </div>
      ) : null}

      <>
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

        {tab === "profile" ? (
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationProfileForm
                key={organization.updatedAt.getTime()}
                organizationId={organization.id}
                currentName={organization.name}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "contact" ? (
          <Card>
            <CardHeader>
              <CardTitle>Contact information</CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationContactForm
                key={organization.updatedAt.getTime()}
                organizationId={organization.id}
                defaults={{
                  contactEmail: organization.contactEmail,
                  contactPhone: organization.contactPhone,
                  addressLine1: organization.addressLine1,
                  addressLine2: organization.addressLine2,
                  city: organization.city,
                  region: organization.region,
                  postalCode: organization.postalCode,
                  country: organization.country,
                }}
              />
            </CardContent>
          </Card>
        ) : null}

        {tab === "users" ? (
          <DataTable
            headers={[
              { key: "name", label: "User", sortable: true },
              { key: "createdAt", label: "Created at", sortable: true },
              { key: "role", label: "Role" },
              { key: "status", label: "Status", sortable: true },
              { key: "actions", label: "", className: "text-right" },
            ]}
            page={members.page}
            pageSize={members.pageSize}
            totalCount={members.totalCount}
            totalPages={members.totalPages}
            sortBy={memberParams.sortBy ?? "createdAt"}
            sortDir={memberParams.sortDir ?? "asc"}
            paramPrefix="mem_"
            searchPlaceholder="Search users..."
            filters={memberFilters}
            rightSlot={
              <AddMemberButton
                organizationId={id}
                organizationName={organization.name}
                roles={roles.map((r) => ({
                  id: r.id,
                  name: r.scope === "GLOBAL" ? `${r.name} (Global)` : r.name,
                }))}
              />
            }
          >
            {members.items.map((membership) => (
              <MemberRow
                key={membership.id}
                organizationId={id}
                roles={roles.map((r) => ({ id: r.id, name: r.scope === "GLOBAL" ? `${r.name} (Global)` : r.name }))}
                member={{
                  membershipId: membership.id,
                  userId: membership.userId,
                  email: membership.user.email,
                  name: membership.user.name,
                  status: membership.status,
                  roleNames: roleNamesByUser.get(membership.userId) ?? [],
                  currentRoleId: roleIdsByUser.get(membership.userId),
                  createdAt: membership.createdAt,
                }}
              />
            ))}
            {members.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-[#9aa6bc]">
                  No users found.
                </td>
              </tr>
            ) : null}
          </DataTable>
        ) : null}

        {tab === "subscriptions" && canViewBilling ? (
          <OrganizationBillingSection organizationId={organization.id} rawParams={rawParams} />
        ) : null}
      </>
    </div>
  );
}
