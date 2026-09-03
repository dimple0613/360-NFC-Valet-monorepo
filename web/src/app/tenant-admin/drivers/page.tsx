import { UsersIcon, UserPlusIcon, ShieldCheckIcon } from "lucide-react";
import { requireIdentity } from "@/lib/auth/current-user";
import { parseListQueryParams } from "@/lib/list-query-params";
import { PageHeader } from "@/components/page-header";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { listDriversForTable } from "../_lib/valet-data";
import { CreateDriverDialog } from "./create-driver-dialog";
import { DriverTableRow } from "./driver-row";

export default async function DriversPage({
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

  const data = await listDriversForTable({
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
      { value: "on_shift", label: "On Shift" },
      { value: "on_break", label: "On Break" },
      { value: "off_duty", label: "Off Duty" },
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
        icon={<UsersIcon className="size-5" />}
        title="Valet drivers"
        description={`${data.totalCount} drivers · valet staff, their assignment, shift status, and performance.`}
        actions={<CreateDriverDialog fields={fields} />}
      />

      <DataTable
        headers={[
          { key: "name", label: "Driver", sortable: true },
          { key: "email", label: "Email" },
          { key: "property", label: "Property", sortable: true },
          { key: "today", label: "Today", sortable: true },
          { key: "avgMin", label: "Avg return", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "actions", label: "", className: "text-right" },
        ]}
        page={data.page}
        pageSize={data.pageSize}
        totalCount={data.totalCount}
        totalPages={data.totalPages}
        sortBy={listParams.sortBy ?? "name"}
        sortDir={listParams.sortDir ?? "asc"}
        searchPlaceholder="Search name, ID, email…"
        filters={[statusFilter, propertyFilter]}
      >
        {data.items.map((driver) => (
          <DriverTableRow key={driver.id} driver={driver} fields={fields} />
        ))}
        {data.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-[#9aa6bc]">
              No drivers found.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3.5 sm:flex-row">
          <div className="flex flex-1 items-center gap-3.5 rounded-2xl border border-[#e7eaf0] bg-white p-4 px-5">
            <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#feeff0]">
              <UserPlusIcon size={19} strokeWidth={2} color="#F4531F" />
            </div>
            <div>
              <div className="text-[13.5px] font-extrabold text-[#1c2b46]">Add driver = 30 seconds</div>
              <div className="text-[11.5px] font-semibold text-[#6c7a93]">
                Name + property → auto-generates VD-ID and a first-login PIN sent by SMS.
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3.5 rounded-2xl border border-[#e7eaf0] bg-white p-4 px-5">
            <div className="flex size-10 items-center justify-center rounded-[12px] bg-[#e7f7ef]">
              <ShieldCheckIcon size={19} strokeWidth={2} color="#0C9D61" />
            </div>
            <div>
              <div className="text-[13.5px] font-extrabold text-[#1c2b46]">Per-driver accountability</div>
              <div className="text-[11.5px] font-semibold text-[#6c7a93]">
                Every activation, park and return is stamped with the driver ID.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
