"use client";

import { ListOrderedIcon } from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OrderConditionDialog,
  type OrderCondition,
} from "./order-condition-dialog";

interface QueueOrder {
  id: number;
  plate: string;
  car: string;
  zone: string | null;
  slot: string | null;
  status: string;
  createdAt: Date | string;
  droppedAt: Date | string | null;
  returnedAt: Date | string | null;
  guestEta: Date | string | null;
  property: string;
  driver: string;
  cardUid: string | null;
  validations: number;
  condition: OrderCondition | null;
  conditionUpdatedAt: Date | string | null;
  conditionUpdatedBy: string | null;
}

interface QueueCounts {
  all: number;
  toPark: number;
  parked: number;
  onway: number;
  overdue: number;
  done: number;
}

interface QueueData {
  orders: QueueOrder[];
  counts: QueueCounts;
  properties: { id: number; name: string; area: string }[];
  drivers: { id: number; label: string }[];
  total: number;
  page: number;
  pageSize: number;
}

const TABS = [
  { key: null, label: "All" },
  { key: "to_park", label: "To park" },
  { key: "parked", label: "Parked" },
  { key: "onway", label: "On the way" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Done" },
];

const POLL_MS = 15_000;

function fmtTime(d: Date | string | null | undefined): string {
  return d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function fmtDate(d: Date | string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
}

function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min || 0));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  active: { label: "TO PARK", tone: "orange" },
  parked: { label: "PARKED", tone: "navy" },
  returning: { label: "ON THE WAY", tone: "amber" },
  retrieving: { label: "RETRIEVING", tone: "amber" },
};

function statusMeta(o: QueueOrder, now: number) {
  const etaPassed = o.guestEta && new Date(o.guestEta).getTime() < now;
  const stuck =
    !o.guestEta &&
    ["active", "parked"].includes(o.status) &&
    new Date(o.createdAt).getTime() < now - 2 * 60 * 60 * 1000;
  if (o.status === "returned") return { label: "DONE", tone: "green", overdue: false } as const;
  if (etaPassed || stuck) return { label: "OVERDUE", tone: "red", overdue: true } as const;
  return {
    label: STATUS_META[o.status]?.label ?? String(o.status).toUpperCase(),
    tone: STATUS_META[o.status]?.tone ?? "gray",
    overdue: false,
  } as const;
}

const TONE_COLOR: Record<string, string> = {
  green: "#0C9D61",
  orange: "#F4531F",
  navy: "#1C2B46",
  amber: "#B97B17",
  red: "#E23D3D",
  gray: "#9AA6BC",
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const color = TONE_COLOR[tone] || "#9AA6BC";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.4px]"
      style={{ background: `${color}14`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

const DAMAGE_LABELS: Record<string, string> = {
  scratches: "Scratches",
  dents: "Dents",
  glass: "Glass",
  lights: "Lights",
  mirrors: "Mirrors",
  wheels: "Wheels / tyres",
  other: "Other",
};

function conditionSummary(o: QueueOrder): string {
  const parts: string[] = [];
  if (o.condition?.damage?.length) {
    parts.push(o.condition.damage.slice(0, 3).map((k) => DAMAGE_LABELS[k] ?? k).join(", "));
    if (o.condition.damage.length > 3) parts[parts.length - 1] += ` +${o.condition.damage.length - 3}`;
  }
  if (o.condition?.mileageKm != null) parts.push(`${o.condition.mileageKm.toLocaleString("en-GB")} km`);
  if (o.condition?.notes) parts.push("notes");
  return parts.length ? parts.join(" · ") : "—";
}

function hasCondition(o: QueueOrder): boolean {
  return (
    (o.condition?.damage?.length ?? 0) > 0 ||
    o.condition?.mileageKm != null ||
    (o.condition?.notes ?? "").trim() !== ""
  );
}

function timerCell(o: QueueOrder, now: number): string {
  if (o.status === "returned" && o.droppedAt && o.returnedAt) {
    return fmtDuration((new Date(o.returnedAt).getTime() - new Date(o.droppedAt).getTime()) / 60000);
  }
  if (o.guestEta) {
    const left = new Date(o.guestEta).getTime() - now;
    if (left <= 0) return "waiting";
    return `ETA ${Math.ceil(left / 60000)} min`;
  }
  return "—";
}

export default function QueuePageClient({
  initialData,
  days: initialDays,
  property: initialProperty,
  driver: initialDriver,
  status: initialStatus,
  canManageQueue,
}: {
  initialData: QueueData;
  days: number;
  property: string;
  driver: string;
  status: string | null;
  canManageQueue: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const [polling, setPolling] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const days = initialDays;
  const property = initialProperty;
  const driver = initialDriver;
  const status = initialStatus;

  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize")) || 20));
  const q = searchParams.get("q") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortDir = (searchParams.get("sortDir") as "asc" | "desc") ?? "desc";

  const [data, setData] = useState<QueueData>(initialData);
  const [conditionOrder, setConditionOrder] = useState<QueueOrder | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("days", String(days));
      if (property !== "all") params.set("property", property);
      if (driver !== "all") params.set("driver", driver);
      if (status) params.set("status", status);
      if (page > 1) params.set("page", String(page));
      if (pageSize !== 20) params.set("pageSize", String(pageSize));
      if (q) params.set("q", q);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/platform/valet/queue?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // silently retry next interval
    }
  }, [days, property, driver, status, page, pageSize, q, sortBy, sortDir]);

  useEffect(() => {
    const kick = window.setTimeout(() => setData(initialData), 0);
    return () => window.clearTimeout(kick);
  }, [initialData]);

  useEffect(() => {
    if (!polling) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    const kick = window.setTimeout(() => void fetchQueue(), 0);
    intervalRef.current = setInterval(() => void fetchQueue(), POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.clearTimeout(kick);
    };
  }, [polling, fetchQueue]);

  const activeTab = status || "all";
  const countMap: Record<string, number> = {
    all: data.counts.all,
    to_park: data.counts.toPark,
    parked: data.counts.parked,
    onway: data.counts.onway,
    overdue: data.counts.overdue,
    done: data.counts.done,
  };

  const withMeta = useMemo(
    () => data.orders.map((o) => ({ ...o, meta: statusMeta(o, now) })),
    [data.orders, now]
  );

  function updateUrl(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(updates)) {
      if (value === null) next.delete(name);
      else next.set(name, value);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const orderFilters = [
    {
      name: "property",
      value: property,
      label: "Property",
      allLabel: "All properties",
      options: data.properties.map((p) => ({ value: String(p.id), label: p.name })),
    },
    {
      name: "driver",
      value: driver,
      label: "Driver",
      allLabel: "All drivers",
      options: (data.drivers ?? []).map((d) => ({ value: String(d.id), label: d.label })),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={<ListOrderedIcon className="size-5" />}
        title={
          <div className="flex items-center gap-2.5">
            <h1 className="flex items-center gap-2 text-title">Live Queue</h1>
            <span className="text-[11px] font-semibold text-[#9AA6BC]">
              {data.counts.all} orders · last {days} days
            </span>
            <button
              type="button"
              onClick={() => setPolling((p) => !p)}
              className="flex items-center gap-1.5 line-height-[unset] rounded-full border border-[#e7eaf0] bg-white px-3 py-1 text-[11px] font-bold text-[#48566e] transition hover:bg-[#f6f7fa]"
            >
              <span
                className={`size-1.5 rounded-full ${polling ? "animate-pulse bg-[#0C9D61]" : "bg-[#9AA6BC]"}`}
              />
              {polling ? "Auto-refresh" : "Paused"}
            </button>
          </div>
        }
        description="Real-time valet queue with drop-offs, retrievals, and overdue tracking."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Select
              value={String(days)}
              items={[
                { value: "1", label: "Today" },
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
              ]}
              onValueChange={(v) => updateUrl({ days: String(Number(v ?? 7)), page: null })}
            >
              <SelectTrigger className="h-[34px] rounded-full border-[1.5px] border-[#e7eaf0] bg-white px-4 text-[12.5px] font-bold text-[#1c2b46]">
                <span className="font-semibold text-[#6c7a93]">Range:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
       

        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const isActive = activeTab === (tab.key || "all");
            const count = tab.key ? countMap[tab.key] : data.counts.all;
            const params = new URLSearchParams(searchParams.toString());
            if (tab.key) params.set("status", tab.key);
            else params.delete("status");
            params.delete("page");
            return (
              <button
                key={tab.key || "all"}
                type="button"
                onClick={() => router.push(`${pathname}?${params.toString()}`)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 99,
                  border: "1px solid #E7EAF0",
                  background: isActive ? "#1C2B46" : "#fff",
                  color:
                    isActive
                      ? "#fff"
                      : tab.key === "overdue" && count > 0
                        ? "#E23D3D"
                        : "#48566E",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {tab.label} · {count}
              </button>
            );
          })}
        </div>

        <DataTable
          headers={[
            { key: "order", label: "Order", sortable: true },
            { key: "vehicle", label: "Vehicle", sortable: true },
            { key: "card", label: "Card", sortable: true },
            { key: "property", label: "Property", sortable: true },
            { key: "driver", label: "Driver", sortable: true },
            { key: "zone", label: "Zone · Slot", sortable: true },
            { key: "condition", label: "Condition" },
            { key: "status", label: "Status" },
            { key: "timer", label: "Timer", className: "text-right" },
          ]}
          page={page}
          pageSize={pageSize}
          totalCount={data.total}
          totalPages={Math.max(1, Math.ceil(data.total / pageSize))}
          sortBy={sortBy}
          sortDir={sortDir}
          searchPlaceholder="Search plate, card or driver…"
          filters={orderFilters}
        >
          {withMeta.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <div className="text-[13px] font-extrabold text-[#16213a]">#{o.id}</div>
                <div className="text-[11.5px] font-semibold text-[#9AA6BC]">
                  {fmtDate(o.createdAt)} · {fmtTime(o.createdAt)}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-[13px] font-extrabold text-[#16213a]">{o.plate}</div>
                <div className="text-[11.5px] font-semibold text-[#9AA6BC]">{o.car || "—"}</div>
              </TableCell>
              <TableCell className="text-[12px] font-bold text-[#6c7a93]">
                {o.cardUid ? `#${o.cardUid}` : "—"}
              </TableCell>
              <TableCell className="text-[12.5px] font-bold text-[#48566e]">{o.property}</TableCell>
              <TableCell className="text-[12.5px] font-bold text-[#48566e]">{o.driver}</TableCell>
              <TableCell className="text-[12px] font-semibold text-[#6c7a93]">
                {o.zone ? `${o.zone} · ${o.slot ?? "—"}` : "—"}
              </TableCell>
              <TableCell>
                {canManageQueue ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConditionOrder(o)}
                      aria-label={`${hasCondition(o) ? "Edit" : "Add"} condition for order ${o.id}`}
                      className={`inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-extrabold transition ${
                        hasCondition(o)
                          ? "border-[#f4531f]/40 bg-[#f4531f]/5 text-[#f4531f] hover:bg-[#f4531f]/10"
                          : "border-[#e7eaf0] bg-white text-[#6c7a93] hover:border-[#cdd5e0]"
                      }`}
                    >
                      {hasCondition(o) ? "Edit" : "Add"} condition
                    </button>
                    <div className="mt-1 max-w-[180px] truncate text-[11px] font-semibold text-[#9AA6BC]" title={conditionSummary(o)}>
                      {conditionSummary(o)}
                    </div>
                  </>
                ) : (
                  <div className="max-w-[180px] truncate text-[11.5px] font-semibold text-[#6c7a93]" title={conditionSummary(o)}>
                    {hasCondition(o) ? conditionSummary(o) : "—"}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge label={o.meta.label} tone={o.meta.tone} />
              </TableCell>
              <TableCell className="text-right">
                <span
                  className="text-[12.5px] font-extrabold"
                  style={{ color: o.meta.overdue ? "#E23D3D" : o.status === "returned" ? "#6C7A93" : "#1C2B46" }}
                >
                  {timerCell(o, now)}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {data.orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                No orders for this filter.
              </TableCell>
            </TableRow>
          ) : null}
        </DataTable>
      </div>

      {conditionOrder ? (
        <OrderConditionDialog
          key={conditionOrder.id}
          orderId={conditionOrder.id}
          plate={conditionOrder.plate}
          car={conditionOrder.car}
          initial={conditionOrder.condition}
          onSaved={(condition) => {
            setData((d) => ({
              ...d,
              orders: d.orders.map((r) => (r.id === conditionOrder.id ? { ...r, condition } : r)),
            }));
          }}
          onClose={() => setConditionOrder(null)}
        />
      ) : null}
    </div>
  );
}
