import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireIdentity } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { getDriverDetail } from "../../_lib/valet-data";
import { fmtDuration, fmtDateTime, DriverStatusBadge, initialsOf } from "../../_lib/valet-ui";
import { fieldsForDriver } from "../../_lib/valet-data";
import { DriverDetailActions } from "./driver-actions";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireIdentity();
  const { id } = await params;
  const organizationId = identity.session.organizationId ?? null;
  let detail;
  try {
    detail = await getDriverDetail(Number(id), organizationId);
  } catch (e: any) {
    if (e?.message === "Driver not found") notFound();
    throw e;
  }

  const d = detail.driver;
  const fields = await fieldsForDriver(organizationId);

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
