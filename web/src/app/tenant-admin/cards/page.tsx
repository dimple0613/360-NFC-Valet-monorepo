import { requireIdentity } from "@/lib/auth/current-user";
import { parseListQueryParams } from "@/lib/list-query-params";
import { PageHeader } from "@/components/page-header";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { listCardsForTable } from "../_lib/valet-data";
import { CardTableRow } from "./card-row";
import { RegisterCardsDialog } from "./register-cards-dialog";
import { NfcIcon } from "lucide-react";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const searchParamsResolved = await searchParams;
  const listParams = parseListQueryParams(searchParamsResolved);
  const propertyRaw = Array.isArray(searchParamsResolved.property)
    ? searchParamsResolved.property[0]
    : searchParamsResolved.property;
  const property = propertyRaw && propertyRaw !== "all" ? propertyRaw : undefined;

  const data = await listCardsForTable({
    q: listParams.q,
    page: listParams.page,
    pageSize: listParams.pageSize,
    sortBy: listParams.sortBy,
    sortDir: listParams.sortDir,
    status: listParams.status,
    property,
    organizationId: identity.session.organizationId ?? null,
  });

  const fields = data.properties.map((p) => ({ id: p.id, name: p.name }));

  const statusFilter: DataTableFilter = {
    name: "status",
    value: listParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "ready", label: "Ready" },
      { value: "with_guest", label: "With guest" },
      { value: "returned", label: "Returned" },
      { value: "blocked", label: "Blocked / Lost" },
    ],
  };

  const propertyFilter: DataTableFilter = {
    name: "property",
    value: property ?? "",
    label: "Property",
    allLabel: "All properties",
    options: data.properties.map((p) => ({ value: String(p.id), label: p.name })),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="NFC Cards"
        description={`${data.totalCount} cards across ${data.properties.length} properties`}
        icon={<NfcIcon />}
        actions={<RegisterCardsDialog fields={fields} />}
      />

      <DataTable
        headers={[
          { key: "uid", label: "UID", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "property", label: "Property", sortable: true },
          { key: "lastUsed", label: "Last used", sortable: true },
          { key: "uses", label: "Uses", sortable: true },
          { key: "lastOrder", label: "Last order" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={data.page}
        pageSize={data.pageSize}
        totalCount={data.totalCount}
        totalPages={data.totalPages}
        sortBy={listParams.sortBy ?? "uid"}
        sortDir={listParams.sortDir ?? "asc"}
        searchPlaceholder="Search card UID…"
        filters={[statusFilter, propertyFilter]}
      >
        {data.items.map((card) => (
          <CardTableRow key={card.id} card={card} />
        ))}
        {data.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-[#9aa6bc]">
              No cards found.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
