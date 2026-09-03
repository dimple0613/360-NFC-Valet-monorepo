import { CreditCardIcon } from "lucide-react";
import { listAllSubscriptionsSearch } from "@saasclaude/db";
import { PageHeader } from "@/components/page-header";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { SubscriptionRow } from "../organizations/subscription-row";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";

/**
 * The sidebar's "Subscriptions" entry — unfiltered across every org, one row
 * per subscription. Distinct from the org detail page's own Subscriptions
 * tab (billing-section.tsx), which reuses the same SubscriptionRow but
 * scoped to a single organization — "open from the menu -> all customers;
 * open inside a customer -> customer-specific."
 */
export default async function SuperAdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.view_billing");
  const listParams = parseListQueryParams(await searchParams);
  const subscriptions = await listAllSubscriptionsSearch(listParams);

  const statusFilter: DataTableFilter = {
    name: "status",
    value: listParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "TRIALING", label: "Trialing" },
      { value: "ACTIVE", label: "Active" },
      { value: "PAUSED", label: "Paused" },
      { value: "PAST_DUE", label: "Past due" },
      { value: "CANCELED", label: "Canceled" },
      { value: "TERMINATED", label: "Terminated" },
      { value: "EXPIRED", label: "Expired" },
    ],
  };
  const dateRangeFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: listParams.dateFrom ?? "",
    valueTo: listParams.dateTo ?? "",
    label: "Created",
    allLabel: "",
    options: [],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<CreditCardIcon className="size-5" />}
        title="Subscriptions"
        description="Every active and historical subscription across every customer organization, unfiltered."
      />

      <DataTable
        headers={[
          { key: "organizationName", label: "Customer", sortable: true },
          { key: "planName", label: "Plan", sortable: true },
          { key: "currentPeriodEnd", label: "Next billing", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={subscriptions.page}
        pageSize={subscriptions.pageSize}
        totalCount={subscriptions.totalCount}
        totalPages={subscriptions.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search subscriptions..."
        filters={[statusFilter, dateRangeFilter]}
      >
        {subscriptions.items.map((subscription) => (
          <SubscriptionRow
            key={subscription.id}
            subscription={{
              id: subscription.id,
              organizationId: subscription.organizationId,
              organizationName: subscription.organizationName,
              organizationEmail: subscription.organizationEmail,
              organizationPhone: subscription.organizationPhone,
              planName: subscription.planName,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd,
              trialEndsAt: subscription.trialEndsAt,
              canceledAt: subscription.canceledAt,
              terminatedAt: subscription.terminatedAt,
            }}
          />
        ))}
        {subscriptions.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-[#9aa6bc]">
              No subscriptions found.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
