import { InboxIcon } from "lucide-react";
import { listInAppNotifications } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatDateTime, titleCase } from "@/lib/format";
import { parseListQueryParams } from "@/lib/list-query-params";
import { PageHeader } from "@/components/page-header";

const KIND_OPTIONS = ["invite", "order", "billing", "security", "system", "offer"];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  const params = parseListQueryParams(await searchParams);

  const all = organizationId ? await listInAppNotifications(organizationId, identity.user.id, 500) : [];

  const q = params.q?.trim().toLowerCase();
  const kind = params.status;
  const from = params.dateFrom ? new Date(params.dateFrom) : null;
  const to = params.dateTo ? new Date(params.dateTo) : null;

  let filtered = all.filter((n) => {
    if (q && !`${n.subject} ${n.body}`.toLowerCase().includes(q)) return false;
    if (kind && kind !== n.kind) return false;
    const t = n.createdAt.getTime();
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime() + 24 * 60 * 60 * 1000) return false;
    return true;
  });

  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 15;
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const rows = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const kindFilter: DataTableFilter = {
    name: "status",
    value: kind ?? "",
    label: "Type",
    allLabel: "All types",
    options: KIND_OPTIONS.map((k) => ({ value: k, label: titleCase(k) })),
  };
  const dateRangeFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: params.dateFrom ?? "",
    valueTo: params.dateTo ?? "",
    label: "Received",
    allLabel: "",
    options: [],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<InboxIcon className="size-5" />}
        title="Inbox"
        description="Notifications delivered to you inside the app, newest first."
      />

      <DataTable
        headers={[
          { key: "subject", label: "Subject" },
          { key: "kind", label: "Type" },
          { key: "createdAt", label: "Received", sortable: true },
        ]}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        searchPlaceholder="Search subject or body..."
        filters={[kindFilter, dateRangeFilter]}
      >
        {rows.map((notification) => (
          <TableRow key={notification.id}>
            <TableCell>
              <span className="text-[13px] font-bold text-[#1c2b46]">{notification.subject}</span>
              <span className="block text-xs text-muted-foreground">{notification.body}</span>
            </TableCell>
            <TableCell>
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-wide bg-[#f1f3f6] text-[#6c7a93]">
                {titleCase(notification.kind)}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {formatDateTime(notification.createdAt)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-[#9aa6bc]">
              No notifications found.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
