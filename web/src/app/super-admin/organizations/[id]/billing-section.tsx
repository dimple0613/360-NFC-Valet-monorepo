import { listSubscriptionsForOrganizationSearch } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { SubscriptionRow } from "../subscription-row";
import { parseListQueryParams } from "@/lib/list-query-params";

/**
 * Per-org subscription HISTORY (every subscription this org has ever had,
 * not just the current one) — read-only, same row shape as the cross-org
 * /super-admin/billing page (SubscriptionRow), just scoped to one org and
 * without the "Subscribed by" link since that's already implied here. No
 * Disable-recurring/Delete: those would need real Stripe/PayPal cancel
 * calls, which don't exist anywhere in this codebase yet — building the
 * button without the real provider call would silently desync our DB from
 * what the customer is actually being charged.
 */
export async function OrganizationBillingSection({
  organizationId,
  rawParams,
}: {
  organizationId: string;
  rawParams: Record<string, string | string[] | undefined>;
}) {
  const subParams = parseListQueryParams(rawParams, "sub_");
  const subscriptions = await listSubscriptionsForOrganizationSearch(organizationId, subParams);

  const statusFilter = {
    name: "status",
    value: subParams.status ?? "",
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

  return (
    <DataTable
      headers={[
        { key: "planName", label: "Plan", sortable: true },
        { key: "currentPeriodEnd", label: "Next billing", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "actions", label: "", className: "text-right" },
      ]}
      page={subscriptions.page}
      pageSize={subscriptions.pageSize}
      totalCount={subscriptions.totalCount}
      totalPages={subscriptions.totalPages}
      sortBy={subParams.sortBy ?? "createdAt"}
      sortDir={subParams.sortDir ?? "desc"}
      paramPrefix="sub_"
      searchPlaceholder="Search subscriptions..."
      filters={[statusFilter]}
    >
      {subscriptions.items.map((subscription) => (
        <SubscriptionRow
          key={subscription.id}
          subscription={{
            id: subscription.id,
            organizationId,
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
          <TableCell colSpan={4} className="text-center text-[#9aa6bc]">
            No subscriptions yet.
          </TableCell>
        </TableRow>
      ) : null}
    </DataTable>
  );
}
