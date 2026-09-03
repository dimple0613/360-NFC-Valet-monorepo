import Link from "next/link";
import { Building2Icon, PlusIcon } from "lucide-react";
import { getUserPlatformPermissions, listOrganizationsWithSummarySearch, listPlans } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { OrganizationTableRow } from "./organization-row";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requirePlatformAccess("core.platform.manage_organizations");
  const listParams = parseListQueryParams(await searchParams);

  const [organizations, plans, permissions] = await Promise.all([
    listOrganizationsWithSummarySearch(listParams),
    listPlans({}),
    getUserPlatformPermissions(identity.session.userId),
  ]);
  const canManageBilling = permissions.includes("core.platform.manage_billing");

  const statusFilter = {
    name: "status",
    value: listParams.status ?? "",
    label: "Status",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "SUSPENDED", label: "Suspended" },
      { value: "ARCHIVED", label: "Archived" },
      { value: "PENDING_DELETION", label: "Pending deletion" },
    ],
    allLabel: "All statuses",
  };
  const planFilter = {
    name: "plan",
    value: listParams.plan ?? "",
    label: "Plan",
    options: plans.map((p) => ({ value: p.key, label: p.name })),
    allLabel: "All plans",
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Building2Icon className="size-5" />}
        title="Customers"
        description="Every organization on the platform — manage their profile, users, plans, and subscriptions."
        actions={
          <Link
            href="/super-admin/organizations/new"
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
            New customer
          </Link>
        }
      />

      <DataTable
        headers={[
          { key: "name", label: "Customer", sortable: true },
          { key: "planName", label: "Plan" },
          { key: "status", label: "Status", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={organizations.page}
        pageSize={organizations.pageSize}
        totalCount={organizations.totalCount}
        totalPages={organizations.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search customers..."
        filters={[statusFilter, planFilter]}
      >
        {organizations.items.map((organization) => (
          <OrganizationTableRow
            key={organization.id}
            organization={organization}
            plans={plans.map((p) => ({ key: p.key, name: p.name }))}
            canManageBilling={canManageBilling}
          />
        ))}
        {organizations.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-[#9aa6bc]">
              No customers found.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
