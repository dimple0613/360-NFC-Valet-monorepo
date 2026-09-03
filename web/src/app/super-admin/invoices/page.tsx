import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { listAllInvoicesSearch, listAllWebhookEventsSearch } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { cn } from "@/lib/utils";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { InvoiceTableRow } from "./invoice-row";

/**
 * The sidebar's "Invoices" entry — unfiltered across every org, one row per
 * invoice, plus a Transactions tab for the raw cross-org payment-provider
 * event feed. Same "open from the menu -> all customers" scope as the
 * Subscriptions page; the per-subscription Logs page (organizations/[id]/
 * subscriptions/[subscriptionId]) covers the customer-specific equivalent.
 */
export default async function PlatformInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.view_billing");
  const rawParams = await searchParams;
  const invoiceParams = parseListQueryParams(rawParams, "inv_");
  const txnParams = parseListQueryParams(rawParams, "txn_");

  const [invoices, transactions] = await Promise.all([
    listAllInvoicesSearch(invoiceParams),
    listAllWebhookEventsSearch(txnParams),
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
  const invoiceDateFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: invoiceParams.dateFrom ?? "",
    valueTo: invoiceParams.dateTo ?? "",
    label: "Issued",
    allLabel: "",
    options: [],
  };
  const txnTypeFilter: DataTableFilter = {
    name: "type",
    value: txnParams.type ?? "",
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
  const txnDateFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: txnParams.dateFrom ?? "",
    valueTo: txnParams.dateTo ?? "",
    label: "Received",
    allLabel: "",
    options: [],
  };

  const tab = rawParams.tab === "transactions" ? "transactions" : "invoices";

  const tabHref = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    if (target === "invoices") params.delete("tab");
    else params.set("tab", target);
    const qs = params.toString();
    return `/super-admin/invoices${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { value: "invoices", label: "Invoices" },
    { value: "transactions", label: "Transactions" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<FileTextIcon className="size-5" />}
        title="Invoices"
        description="Every invoice across every customer, plus the raw payment-provider transaction feed."
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
            { key: "number", label: "Invoice", sortable: true },
            { key: "organization", label: "Customer", sortable: true },
            { key: "createdAt", label: "Created at", sortable: true },
            { key: "totalCents", label: "Amount", sortable: true },
            { key: "status", label: "Status", sortable: true },
          ]}
          page={invoices.page}
          pageSize={invoices.pageSize}
          totalCount={invoices.totalCount}
          totalPages={invoices.totalPages}
          sortBy={invoiceParams.sortBy ?? "createdAt"}
          sortDir={invoiceParams.sortDir ?? "desc"}
          paramPrefix="inv_"
          searchPlaceholder="Search by number or organization..."
          filters={[invoiceStatusFilter, invoiceDateFilter]}
        >
          {invoices.items.map((invoice) => (
            <InvoiceTableRow key={invoice.id} invoice={invoice} />
          ))}
          {invoices.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No invoices found.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}

      {tab === "transactions" ? (
        <DataTable
          headers={[
            { key: "eventType", label: "Type", sortable: true },
            { key: "organization", label: "Organization" },
            { key: "processedAt", label: "Received", sortable: true, className: "text-muted-foreground" },
          ]}
          page={transactions.page}
          totalCount={transactions.totalCount}
          totalPages={transactions.totalPages}
          sortBy={txnParams.sortBy ?? "processedAt"}
          sortDir={txnParams.sortDir ?? "desc"}
          paramPrefix="txn_"
          searchPlaceholder="Search by event type..."
          filters={[txnTypeFilter, txnDateFilter]}
        >
          {transactions.items.map((event) => (
            <TableRow key={event.id}>
              <TableCell>{event.eventType ?? "—"}</TableCell>
              <TableCell>
                {event.organizationId ? (
                  <Link href={`/super-admin/organizations/${event.organizationId}`} className="underline">
                    {event.organizationName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(event.processedAt)}</TableCell>
            </TableRow>
          ))}
          {transactions.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No transactions recorded yet.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      ) : null}
    </div>
  );
}
