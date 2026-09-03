import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { listAllAuditLogsSearch, prismaWithoutTenantScoping } from "@saasclaude/db";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format";

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  core: "Core",
  billing: "Billing",
  oauth: "OAuth",
  notifications: "Notifications",
  role: "Roles",
};

function moduleDisplayName(module: string) {
  return MODULE_DISPLAY_NAMES[module] ?? module;
}

const ACTION_DISPLAY_NAMES: Record<string, string> = {
  "cross_tenant_access_denied": "Cross-tenant access denied",
};

/** Turns "subscription.renewed" into "Subscription renewed" / keeps underscores readable. */
function actionDisplayName(action: string) {
  if (ACTION_DISPLAY_NAMES[action]) return ACTION_DISPLAY_NAMES[action];
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function PlatformReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.view_audit_log");
  const listParams = parseListQueryParams(await searchParams);
  const [logs, modules, actions] = await Promise.all([
    listAllAuditLogsSearch(listParams),
    prismaWithoutTenantScoping.auditLog.findMany({
      distinct: ["module"],
      select: { module: true },
      orderBy: { module: "asc" },
    }),
    prismaWithoutTenantScoping.auditLog.groupBy({
      by: ["action"],
      _count: { _all: true },
      orderBy: [{ _count: { action: "desc" } }, { action: "asc" }],
    }),
  ]);

  const moduleFilter: DataTableFilter = {
    name: "module",
    value: listParams.module ?? "",
    label: "Module",
    allLabel: "All modules",
    options: modules.map((m) => ({ value: m.module, label: moduleDisplayName(m.module) })),
  };
  const actionFilter: DataTableFilter = {
    name: "action",
    value: listParams.action ?? "",
    label: "Action",
    allLabel: "All actions",
    options: actions.map((a) => ({ value: a.action, label: actionDisplayName(a.action) })),
  };
  const dateRangeFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: listParams.dateFrom ?? "",
    valueTo: listParams.dateTo ?? "",
    label: "Date",
    allLabel: "",
    options: [],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ScrollTextIcon className="size-5" />}
        title="Audit Log"
        description="A searchable record of platform and billing actions across every customer organization."
      />

      <DataTable
        headers={[
          { key: "createdAt", label: "When", sortable: true },
          { key: "organization", label: "Organization" },
          { key: "actor", label: "Actor" },
          { key: "module", label: "Module", sortable: true },
          { key: "action", label: "Action", sortable: true },
          { key: "resource", label: "Resource" },
        ]}
        page={logs.page}
        totalCount={logs.totalCount}
        totalPages={logs.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search by module, action, or organization..."
        filters={[moduleFilter, actionFilter, dateRangeFilter]}
      >
        {logs.items.map((entry) => (
          <tr key={entry.id} className="border-b border-[#f1f3f6] last:border-b-0 hover:bg-[#fafbfc] transition-colors">
            <td className="px-4 py-3 text-[13px] font-medium text-[#6c7a93]">{formatDateTime(entry.createdAt)}</td>
            <td className="px-4 py-3">
              <Link
                href={`/super-admin/organizations/${entry.organizationId}`}
                className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
              >
                {entry.organizationName}
              </Link>
            </td>
            <td className="px-4 py-3 text-[13px] font-medium text-[#6c7a93]">{entry.actorEmail ?? "System"}</td>
            <td className="px-4 py-3 text-[12px] font-medium text-[#6c7a93]">{moduleDisplayName(entry.module)}</td>
            <td className="px-4 py-3 text-[12px] font-bold text-[#1c2b46]">{actionDisplayName(entry.action)}</td>
            <td className="px-4 py-3 text-[13px] font-medium text-[#6c7a93]">
              {entry.resourceType ? `${entry.resourceType}${entry.resourceId ? ` (${entry.resourceId})` : ""}` : "—"}
            </td>
          </tr>
        ))}
        {logs.items.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-[13px] text-[#9aa6bc]">
              No audit log entries found.
            </td>
          </tr>
        ) : null}
      </DataTable>
    </div>
  );
}