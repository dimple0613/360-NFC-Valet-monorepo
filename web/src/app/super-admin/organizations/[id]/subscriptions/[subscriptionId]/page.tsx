import { notFound } from "next/navigation";
import Link from "next/link";
import { CreditCardIcon } from "lucide-react";
import {
  listInvoicesForSubscriptionSearch,
  listSubscriptionEventsForSubscriptionSearch,
  listWebhookEventsSearch,
  prismaWithoutTenantScoping,
} from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { cn } from "@/lib/utils";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { SubscriptionStatusBadge } from "../../../subscription-row";
import { StatusBadge, INVOICE_STATUS_STYLES } from "@/components/status-badge";
import { formatDate, formatDateTime, formatPrice, titleCase } from "@/lib/format";

export default async function SubscriptionLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; subscriptionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.view_billing");
  const { id, subscriptionId } = await params;
  const rawParams = await searchParams;

  const subscription = await prismaWithoutTenantScoping.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, organization: true },
  });
  if (!subscription || subscription.organizationId !== id) notFound();

  const invoiceParams = parseListQueryParams(rawParams, "inv_");
  const eventParams = parseListQueryParams(rawParams, "log_");
  const webhookParams = parseListQueryParams(rawParams, "txn_");

  const [invoices, events, webhookEvents] = await Promise.all([
    listInvoicesForSubscriptionSearch(id, subscriptionId, invoiceParams),
    listSubscriptionEventsForSubscriptionSearch(id, subscriptionId, eventParams),
    // No subscriptionId column on webhook events (raw provider payloads aren't
    // linked to one subscription in this schema) — org-wide is the closest
    // honest scope, called out in the tab's own description below.
    listWebhookEventsSearch(id, webhookParams),
  ]);

  const invoiceStatusFilter: DataTableFilter = {
    name: "status",
    value: invoiceParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "ISSUED", label: "Issued" },
      { value: "PAID", label: "Paid" },
      { value: "VOID", label: "Void" },
    ],
  };

  const logTypeFilter: DataTableFilter = {
    name: "type",
    value: eventParams.type ?? "",
    label: "Type",
    allLabel: "All types",
    options: [
      { value: "created", label: "Created" },
      { value: "renewed", label: "Renewed" },
      { value: "paused", label: "Paused" },
      { value: "resumed", label: "Resumed" },
      { value: "upgraded", label: "Upgraded" },
      { value: "downgraded", label: "Downgraded" },
      { value: "canceled", label: "Canceled" },
      { value: "expired", label: "Expired" },
    ],
  };

  const transactionTypeFilter: DataTableFilter = {
    name: "type",
    value: webhookParams.type ?? "",
    label: "Type",
    allLabel: "All types",
    options: [
      { value: "invoice.created", label: "Invoice Created" },
      { value: "invoice.paid", label: "Invoice Paid" },
      { value: "invoice.payment_failed", label: "Payment Failed" },
      { value: "customer.subscription.updated", label: "Subscription Updated" },
      { value: "customer.subscription.deleted", label: "Subscription Deleted" },
    ],
  };

  const invoiceDateFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: invoiceParams.dateFrom ?? "",
    valueTo: invoiceParams.dateTo ?? "",
    label: "Issued",
    allLabel: "",
    options: [],
  };
  const transactionDateFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: webhookParams.dateFrom ?? "",
    valueTo: webhookParams.dateTo ?? "",
    label: "Received",
    allLabel: "",
    options: [],
  };
  const logDateFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: eventParams.dateFrom ?? "",
    valueTo: eventParams.dateTo ?? "",
    label: "When",
    allLabel: "",
    options: [],
  };

  const tab = rawParams.tab === "logs" ? "logs" : rawParams.tab === "transactions" ? "transactions" : "invoices";

  const tabHref = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    if (target === "invoices") params.delete("tab");
    else params.set("tab", target);
    const qs = params.toString();
    return `/super-admin/organizations/${id}/subscriptions/${subscriptionId}${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { value: "invoices", label: "Invoices" },
    { value: "transactions", label: "Transactions" },
    { value: "logs", label: "Logs" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<CreditCardIcon className="size-5" />}
        title="Invoices / Logs"
        description={`${subscription.plan?.name ?? "Plan"} subscription for ${subscription.organization.name}.`}
        titleTrailing={<SubscriptionStatusBadge status={subscription.status} />}
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

      {tab === "invoices" ? (
        <DataTable
          headers={[
            { key: "number", label: "Number", sortable: false },
            { key: "status", label: "Status", sortable: true },
            { key: "totalCents", label: "Total", sortable: true },
            { key: "createdAt", label: "Issued", sortable: true, className: "text-muted-foreground" },
          ]}
          page={invoices.page}
          totalCount={invoices.totalCount}
          totalPages={invoices.totalPages}
          sortBy={invoiceParams.sortBy ?? "createdAt"}
          sortDir={invoiceParams.sortDir ?? "desc"}
          paramPrefix="inv_"
          searchPlaceholder="Search by invoice number..."
          filters={[invoiceStatusFilter, invoiceDateFilter]}
        >
          {invoices.items.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>{invoice.number ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge value={invoice.status} styles={INVOICE_STATUS_STYLES} />
              </TableCell>
              <TableCell>{formatPrice(invoice.totalCents, invoice.currency)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(invoice.issuedAt)}</TableCell>
            </TableRow>
          ))}
          {invoices.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No invoices yet.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}

      {tab === "transactions" ? (
        <DataTable
          headers={[
            { key: "eventType", label: "Type", sortable: true },
            { key: "processedAt", label: "Received", sortable: true, className: "text-muted-foreground" },
          ]}
          page={webhookEvents.page}
          totalCount={webhookEvents.totalCount}
          totalPages={webhookEvents.totalPages}
          sortBy={webhookParams.sortBy ?? "processedAt"}
          sortDir={webhookParams.sortDir ?? "desc"}
          paramPrefix="txn_"
          searchPlaceholder="Search by event type..."
          filters={[transactionTypeFilter, transactionDateFilter]}
        >
          {webhookEvents.items.map((event) => (
            <TableRow key={event.id}>
              <TableCell>{event.eventType ? titleCase(event.eventType) : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(event.processedAt)}</TableCell>
            </TableRow>
          ))}
          {webhookEvents.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No transactions recorded yet.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}

      {tab === "logs" ? (
        <DataTable
          headers={[
            { key: "type", label: "Type", sortable: true },
            { key: "createdAt", label: "When", sortable: true, className: "text-muted-foreground" },
          ]}
          page={events.page}
          totalCount={events.totalCount}
          totalPages={events.totalPages}
          sortBy={eventParams.sortBy ?? "createdAt"}
          sortDir={eventParams.sortDir ?? "desc"}
          paramPrefix="log_"
          searchPlaceholder="Search by event type..."
          filters={[logTypeFilter, logDateFilter]}
        >
          {events.items.map((event) => (
            <TableRow key={event.id}>
              <TableCell>{titleCase(event.type)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
            </TableRow>
          ))}
          {events.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No log entries yet.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
    </div>
  );
}
