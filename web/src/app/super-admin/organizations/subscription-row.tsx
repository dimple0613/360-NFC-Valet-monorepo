import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge, SUBSCRIPTION_STATUS_STYLES } from "@/components/status-badge";
import { LogsPill } from "@/components/logs-pill";
import { formatDateTime } from "@/lib/format";

export { SUBSCRIPTION_STATUS_STYLES as STATUS_STYLE } from "@/components/status-badge";

export function formatSubscriptionStatus(status: string): string {
  if (!status) return status;
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Shared colored status pill — same look/colors as the Subscriptions tab rows. */
export function SubscriptionStatusBadge({ status }: { status: string }) {
  return <StatusBadge value={status} styles={SUBSCRIPTION_STATUS_STYLES} label={formatSubscriptionStatus(status)} />;
}

export interface SubscriptionRowData {
  id: string;
  organizationId: string;
  organizationName?: string;
  organizationEmail?: string | null;
  organizationPhone?: string | null;
  planName: string;
  status: string;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  terminatedAt: Date | null;
}

/**
 * One subscription's row — shared by the org detail page's Subscriptions tab
 * (organizationName omitted, already implied by context -> Plan | Next billing
 * | Status | Logs, 4 cells) and the Super Admin sidebar's cross-org
 * /super-admin/billing page (organizationName provided -> Customer | Plan |
 * Next billing | Status | Logs, 5 cells, per the user's own distinction:
 * opened from inside a customer -> customer-specific; opened from the menu ->
 * all customers). Read-only for now — Disable-recurring/Delete would need
 * real Stripe/PayPal cancel calls (they don't exist anywhere in this codebase
 * yet), so only "Logs" is offered.
 *
 * Rendered as a console-styled <TableRow> so it can be dropped into the
 * shared <DataTable> (same look as the org list).
 */
export function SubscriptionRow({ subscription }: { subscription: SubscriptionRowData }) {
  const ended = subscription.terminatedAt ?? subscription.canceledAt;
  const crossOrg = Boolean(subscription.organizationName);

  return (
    <TableRow>
      {crossOrg ? (
        <TableCell>
          <div className="flex flex-wrap items-center" style={{ gap: "11px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#edf0fe",
                color: "#4a5fc9",
                fontSize: 12,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {subscription.organizationName!.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="table-main" style={{ fontSize: 13.5, fontWeight: 800, color: "#1c2b46" }}>
                <Link
                  href={`/super-admin/organizations/${subscription.organizationId}`}
                  className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
                >
                  {subscription.organizationName}
                </Link>
              </div>
              {subscription.organizationEmail ? (
                <div className="table-sub" style={{ fontSize: 11, color: "#6c7a93", fontWeight: 600, marginTop: 1 }}>
                  {subscription.organizationEmail}
                </div>
              ) : null}
            </div>
          </div>
        </TableCell>
      ) : null}
      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{subscription.planName}</div>
      </TableCell>

      <TableCell>
        {ended ? (
          <div>
            <div className="text-[13px] font-bold text-[#1c2b46]">{formatDateTime(ended)}</div>
            <div className="text-[12px] font-medium text-[#6c7a93]">Ended at</div>
          </div>
        ) : (
          <div>
            <div className="text-[13px] font-bold text-[#1c2b46]">
              {formatDateTime(subscription.currentPeriodEnd)}
            </div>
            <div className="text-[12px] font-medium text-[#6c7a93]">Next billing</div>
          </div>
        )}
      </TableCell>

      <TableCell>
        <SubscriptionStatusBadge status={subscription.status} />
      </TableCell>

      <TableCell className="text-right">
        <LogsPill
          href={`/super-admin/organizations/${subscription.organizationId}/subscriptions/${subscription.id}?tab=logs`}
          label={subscription.planName}
        />
      </TableCell>
    </TableRow>
  );
}
