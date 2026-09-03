import { CoinsIcon } from "lucide-react";
import { listCurrenciesSearch } from "@saasclaude/db";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { CreateCurrencyDialog } from "./create-currency-dialog";
import { CurrencyTableRow } from "./currency-row";

export default async function CurrenciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAccess("core.platform.manage_plans");
  const listParams = parseListQueryParams(await searchParams);
  const currencies = await listCurrenciesSearch(listParams);

  const statusFilter: DataTableFilter = {
    name: "status",
    value: listParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<CoinsIcon className="size-5" />}
        title="Currencies"
        description="The currencies plans can be priced in. Formats and statuses apply platform-wide."
        actions={<CreateCurrencyDialog />}
      />

      <DataTable
        headers={[
          { key: "name", label: "Currency", sortable: true },
          { key: "code", label: "Code", sortable: true },
          { key: "format", label: "Format", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={currencies.page}
        pageSize={currencies.pageSize}
        totalCount={currencies.totalCount}
        totalPages={currencies.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search currencies..."
        filters={[statusFilter]}
      >
        {currencies.items.map((currency) => (
          <CurrencyTableRow key={currency.id} currency={currency} />
        ))}
        {currencies.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-[#9aa6bc]">
              No currencies yet.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
