import { requireValetPage } from "../_lib/valet-permissions";
import { parseListQueryParams } from "@/lib/list-query-params";
import { PageHeader } from "@/components/page-header";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { getUserPlatformPermissions } from "@saasclaude/db";
import { listCardsForTable, CARD_STATUSES } from "../_lib/valet-data";
import { CardTableRow } from "./card-row";
import { RegisterCardsDialog } from "./register-cards-dialog";
import { NfcIcon } from "lucide-react";

const CARD_STATUS_LABELS: Record<string, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  printed: "Printed",
  defect: "Defect",
  ready: "Ready",
  with_guest: "With guest",
  returned: "Returned",
  blocked: "Blocked / Lost",
};

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireValetPage("valet.card.read");
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

  // #48: minting new deck cards + running the print/export workflow are
  // platform permissions (valet.card.create / valet.card.print). The image is
  // mirrored in the row actions so no dead buttons show.
  const platformUserId = identity.session.impersonatorUserId ?? identity.user.id;
  const platformPermissions = await getUserPlatformPermissions(platformUserId);
  const canCreateCards = platformPermissions.includes("valet.card.create");
  const canPrintCards = platformPermissions.includes("valet.card.print");

  const statusFilter: DataTableFilter = {
    name: "status",
    value: listParams.status ?? "",
    label: "Status",
    allLabel: "All statuses",
    options: CARD_STATUSES.map((s) => ({ value: s, label: CARD_STATUS_LABELS[s] ?? s })),
  };

  const propertyFilter: DataTableFilter = {
    name: "property",
    value: property ?? "",
    label: "Property",
    allLabel: "All properties",
    options: [
      { value: "unassigned", label: "Unassigned (deck)" },
      ...data.properties.map((p) => ({ value: String(p.id), label: p.name })),
    ],
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="NFC Cards"
        description={`${data.totalCount} cards${data.properties.length ? ` across ${data.properties.length} properties` : ""}`}
        icon={<NfcIcon />}
        actions={canCreateCards ? <RegisterCardsDialog fields={fields} /> : null}
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
        searchPlaceholder="Search card UID or property…"
        filters={[statusFilter, propertyFilter]}
      >
        {data.items.map((card) => (
          <CardTableRow key={card.id} card={card} canPrint={canPrintCards} properties={fields} />
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
