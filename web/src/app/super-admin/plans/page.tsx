import Link from "next/link";
import { PackageIcon, PlusIcon } from "lucide-react";
import { listPlansSearch } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { PlanTableRow } from "./plan-row";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_plans");
  const listParams = parseListQueryParams(await searchParams);
  const plans = await listPlansSearch(listParams);

  const typeFilter: DataTableFilter = {
    name: "type",
    value: listParams.type ?? "",
    label: "Type",
    allLabel: "All types",
    options: [
      { value: "FREE", label: "Free" },
      { value: "TRIAL", label: "Trial" },
      { value: "MONTHLY", label: "Monthly" },
      { value: "YEARLY", label: "Yearly" },
      { value: "LIFETIME", label: "Lifetime" },
      { value: "ENTERPRISE", label: "Enterprise" },
      { value: "USAGE_BASED", label: "Usage based" },
      { value: "CUSTOM_PRICING", label: "Custom pricing" },
      { value: "INVITE_ONLY", label: "Invite only" },
      { value: "HIDDEN", label: "Hidden" },
    ],
  };

  const visibilityFilter: DataTableFilter = {
    name: "visibility",
    value: listParams.visibility ?? "",
    label: "Visibility",
    allLabel: "All visibility",
    options: [
      { value: "PUBLIC", label: "Public" },
      { value: "INVITE_ONLY", label: "Invite only" },
      { value: "HIDDEN", label: "Hidden" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PackageIcon className="size-5" />}
        title="Manage Plans"
        description="The subscription plans customers can be placed on, including pricing, billing cycle, and features."
        actions={
          <Link
            href="/super-admin/plans/new"
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
            Create plan
          </Link>
        }
      />

      <DataTable
        headers={[
          { key: "name", label: "Plan", sortable: true },
          { key: "price", label: "Price", sortable: true },
          { key: "subscribers", label: "Subscribers", sortable: true },
          { key: "visibility", label: "Visibility", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={plans.page}
        pageSize={plans.pageSize}
        totalCount={plans.totalCount}
        totalPages={plans.totalPages}
        sortBy={listParams.sortBy ?? "name"}
        sortDir={listParams.sortDir ?? "asc"}
        searchPlaceholder="Search plans..."
        filters={[typeFilter, visibilityFilter]}
      >
        {plans.items.map((plan) => (
          <PlanTableRow
            key={plan.id}
            plan={{
              id: plan.id,
              key: plan.key,
              name: plan.name,
              description: plan.description,
              visibility: plan.visibility,
              priceCents: plan.priceCents,
              currency: plan.currency,
              billingCycle: plan.billingCycle,
              subscriberCount: plan.subscriberCount,
            }}
          />
        ))}
        {plans.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-[#9aa6bc]">
              No plans yet.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
