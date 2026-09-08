import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireValetPage } from "../../_lib/valet-permissions";
import { PageHeader } from "@/components/page-header";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { getDriverDetail } from "../../_lib/valet-data";
import { fmtDuration, fmtDateTime, DriverStatusBadge, initialsOf } from "../../_lib/valet-ui";
import { fieldsForDriver } from "../../_lib/valet-data";
import { DriverDetailActions } from "./driver-actions";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireValetPage("valet.driver.read");
  const { id } = await params;
  const raw = await searchParams;
  const organizationId = identity.session.organizationId ?? null;

  const actFrom = typeof raw.dateFrom === "string" ? raw.dateFrom : undefined;
  const actTo = typeof raw.dateTo === "string" ? raw.dateTo : undefined;
  const actPropertyRaw = typeof raw.property === "string" ? raw.property : undefined;
  const actProperty = actPropertyRaw && actPropertyRaw !== "all" ? actPropertyRaw : undefined;
  const actPage = raw.page !== undefined ? Number(raw.page) : 1;
  const actPageSize = raw.pageSize !== undefined ? Number(raw.pageSize) : 15;

  let detail;
  try {
    detail = await getDriverDetail(Number(id), organizationId, {
      from: actFrom,
      to: actTo,
      page: actPage,
      pageSize: actPageSize,
      property: actProperty,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Driver not found") notFound();
    throw e;
  }

  const d = detail.driver;
  const fields = await fieldsForDriver(organizationId);

  const today = new Date();
  const past = new Date(today.getTime() - 59 * 24 * 60 * 60 * 1000);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const periodFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: actFrom ?? iso(past),
    valueTo: actTo ?? iso(today),
    label: "Period",
    allLabel: "",
    options: [],
  };

  const propertyFilter: DataTableFilter = {
    name: "property",
    value: actProperty ?? "",
    label: "Property",
    allLabel: "All properties",
    options: fields.map((p) => ({ value: String(p.id), label: p.name })),
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/tenant-admin/drivers"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[#6c7a93] hover:text-[#f4531f] transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Back to drivers
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex size-12 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
          style={{ background: d.color || "#1C2B46" }}
        >
          {d.initials || initialsOf(d.name)}
        </span>
        <PageHeader
          title={d.name}
          titleTrailing={<span className="text-[14px] font-bold text-[#9aa6bc]">{d.valetId}</span>}
          description={`${d.property ?? "Unassigned"} · Joined ${fmtDateTime(d.createdAt)}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DriverStatusBadge status={d.status} />
        <span className="text-[13px] font-semibold text-[#6c7a93]">
          {d.property ?? "Unassigned"} · Today {d.today} · Avg return{" "}
          {d.status === "off_duty" ? "—" : fmtDuration(d.avgMin)}
        </span>
        <div className="ml-auto">
          <DriverDetailActions
            driverId={d.id}
            name={d.name}
            status={d.status}
            propertyId={d.propertyId}
            fields={fields}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[18px] border border-[#e7eaf0] bg-white p-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9AA6BC]">
            Profile
          </div>
          <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#6c7a93]">
            <Row label="Property" value={d.property || "—"} />
            <Row label="Phone" value={d.phone || "—"} />
            <Row label="Email" value={d.email || "—"} />
            <Row label="Emirates ID" value={d.emiratesId || "—"} />
            <Row label="License" value={d.licenseNumber || "—"} />
            <Row label="Nationality" value={d.nationality || "—"} />
            <Row label="Emergency" value={d.emergencyContact || "—"} />
            <Row label="Shift started" value={d.shiftStarted ? fmtDateTime(d.shiftStarted) : "—"} />
            <Row label="Joined" value={fmtDateTime(d.createdAt)} />
          </div>
        </div>

        <div className="rounded-[18px] border border-[#e7eaf0] bg-white p-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9AA6BC]">
            Active orders
          </div>
          {detail.activeOrders.length === 0 ? (
            <div className="mt-3 text-[13px] font-semibold text-[#6c7a93]">No active orders</div>
          ) : (
            <div className="mt-3 space-y-2">
              {detail.activeOrders.map((o) => (
                <div key={o.id} className="rounded-xl border border-[#e7eaf0] bg-white p-3 text-[12.5px]">
                  <div className="font-extrabold text-[#1c2b46]">
                    {o.plate} · {o.car || "—"}
                  </div>
                  <div className="mt-1 font-semibold text-[#6c7a93]">
                    {o.status} · Zone {o.zone || "?"} · Slot {o.slot || "?"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-[#e7eaf0] bg-white p-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9AA6BC]">
            Today&apos;s returns
          </div>
          {detail.recentReturned.length === 0 ? (
            <div className="mt-3 text-[13px] font-semibold text-[#6c7a93]">No returns yet</div>
          ) : (
            <div className="mt-3 space-y-2">
              {detail.recentReturned.map((o) => (
                <div key={o.id} className="rounded-xl border border-[#e7eaf0] bg-white p-3 text-[12.5px]">
                  <div className="font-extrabold text-[#1c2b46]">
                    {o.plate} · {o.car || "—"}
                  </div>
                  <div className="mt-1 font-semibold text-[#6c7a93]">
                    Returned · {fmtDuration(o.returnMin)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-[#e7eaf0] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9AA6BC]">
            Activity report
          </div>
          <div className="flex items-center gap-5 text-[12.5px] font-semibold text-[#6c7a93]">
            <span>Today parked <b className="text-[#f4531f]">{detail.activity.todayParked}</b></span>
            <span>Total parked <b className="text-[#1c2b46]">{detail.activity.totalParked}</b></span>
            <span>Shifts <b className="text-[#1c2b46]">{detail.activity.shifts.length}</b></span>
          </div>
        </div>

        <div className="mt-3">
          <DataTable
            headers={[
              { key: "date", label: "Date" },
              { key: "shift", label: "Shift" },
              { key: "property", label: "Property" },
              { key: "parked", label: "Parked", className: "text-right" },
              { key: "returned", label: "Returned", className: "text-right" },
              { key: "validations", label: "Validations", className: "text-right" },
            ]}
            page={actPage}
            pageSize={actPageSize}
            totalCount={detail.activity.byDayTotal}
            totalPages={Math.max(1, Math.ceil(detail.activity.byDayTotal / actPageSize))}
            hideSearch
            filters={[periodFilter, propertyFilter]}
          >
            {detail.activity.byDay.map((row) => (
              <TableRow key={row.date} className="border-b border-[#eef1f6] last:border-0">
                <TableCell className="text-[12.5px] font-bold text-[#1c2b46]">
                  {row.date}
                  {row.date === todayIso() ? (
                    <span className="ml-2 rounded-full bg-[#FDEBEB] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#F4531F]">
                      Today
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-[12.5px] font-semibold text-[#6c7a93]">
                  {row.shiftStart ? `${row.shiftStart} – ${row.shiftEnd ?? "now"}` : "—"}
                </TableCell>
                <TableCell className="text-[12.5px] font-semibold text-[#6c7a93]">
                  {row.property ?? "—"}
                </TableCell>
                <TableCell className="text-right text-[12.5px] font-bold text-[#f4531f]">
                  {row.parked}
                </TableCell>
                <TableCell className="text-right text-[12.5px] font-semibold text-[#0C9D61]">
                  {row.returned}
                </TableCell>
                <TableCell className="text-right text-[12.5px] font-semibold text-[#6c7a93]">
                  {row.validations}
                </TableCell>
              </TableRow>
            ))}
            {detail.activity.byDay.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-[13px] font-semibold text-[#6c7a93]">
                  No activity recorded for this driver yet.
                </TableCell>
              </TableRow>
            )}
          </DataTable>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#9AA6BC]">
            Shift history
          </div>
          {detail.activity.shifts.length === 0 ? (
            <div className="mt-2 text-[13px] font-semibold text-[#6c7a93]">No shifts recorded yet.</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.activity.shifts.map((s) => (
                <div key={s.id} className="rounded-lg border border-[#e7eaf0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6c7a93]">
                  {fmtDateTime(s.startedAt)} → {s.endedAt ? fmtDateTime(s.endedAt) : "Now"} · {s.property ?? "—"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#9aa6bc]">{label}</span>
      <span className="text-right text-[#1c2b46]">{value}</span>
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
