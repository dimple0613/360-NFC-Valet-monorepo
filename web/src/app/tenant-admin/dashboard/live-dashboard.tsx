"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CarIcon, ClockIcon, TagIcon, UsersIcon, AlertIcon } from "@/app/tenant-admin/_components/valet-icons";
import { PlusIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardData {
  stats: {
    carsParked: number;
    prevCarsParked: number;
    avgReturnTime: number;
    offersValidated: number;
    outletSpend: number;
    driversOnShift: number;
    driversTotal: number;
    overdue: number;
  };
  byProperty: { id: number; name: string; area: string; carsToday: number; color: string }[];
  chart: { label: string; drop: number; ret: number }[];
  live: {
    id: number;
    action: string;
    kind: string;
    time: Date | string;
    plate: string;
    property: string;
  }[];
  properties: { id: number; name: string; area: string }[];
}

const ACTIVITY_DOT: Record<string, string> = {
  returned: "#0C9D61",
  parked: "#F4531F",
  retrieval: "#4A5FC9",
  active: "#B97B17",
};

const POLL_MS = 15_000;

function fmtDuration(totalMin: number): string {
  const m = Math.max(0, totalMin || 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function timeAgo(ts: Date | string | null | undefined): string {
  if (!ts) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function CarsInOutChart({ items }: { items: { label: string; drop: number; ret: number }[] }) {
  if (items.length === 0) {
    return <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "#6C7A93" }}>No data for this period yet.</div>;
  }
  const max = Math.max(...items.map((c) => Math.max(c.drop || 0, c.ret || 0)), 1);
  const n = items.length;
  const slot = 600 / n;
  const barW = Math.max(3, Math.min(22, slot * 0.26));
  const labelIdx = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].filter(
    (v, i, a) => a.indexOf(v) === i
  );
  return (
    <div style={{ marginTop: 12 }}>
      <svg width="100%" height="190" viewBox="0 0 640 190" preserveAspectRatio="none" aria-label="Cars in and out chart">
        <line x1="0" y1="160" x2="640" y2="160" stroke="#EDEFF3" strokeWidth="1" />
        <line x1="0" y1="110" x2="640" y2="110" stroke="#EDEFF3" strokeWidth="1" />
        <line x1="0" y1="60" x2="640" y2="60" stroke="#EDEFF3" strokeWidth="1" />
        {items.map((c, i) => {
          const dropH = Math.round((c.drop / max) * 136);
          const retH = Math.round((c.ret / max) * 136);
          const cx = 20 + i * slot + slot / 2;
          const last = i === items.length - 1;
          return (
            <g key={c.label}>
              <rect
                x={cx - barW - 1}
                y={160 - dropH}
                width={barW}
                height={dropH || 2}
                rx="5"
                fill="#F4531F"
                opacity={last ? 0.45 : 1}
              />
              <rect
                x={cx + 1}
                y={160 - retH}
                width={barW}
                height={retH || 2}
                rx="5"
                fill="#1C2B46"
                opacity={last ? 0.45 : 1}
              />
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text
            key={i}
            x={20 + i * slot + slot / 2}
            y="180"
            fontSize="11"
            fill="#9AA6BC"
            fontWeight="600"
            textAnchor="middle"
          >
            {items[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function StatCard({
  label,
  icon,
  iconBg,
  value,
  delta,
  deltaTone = "up",
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "up" | "amber";
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E7EAF0",
        borderRadius: 16,
        padding: "18px 20px",
        boxShadow: "0 20px 50px rgba(16,22,35,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6C7A93", fontWeight: 700 }}>{label}</span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
            background: iconBg,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8, letterSpacing: "-0.5px", color: "#16213a" }}>
        {value}
      </div>
      {delta ? (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            marginTop: 3,
            color: deltaTone === "amber" ? "#B97B17" : "#0C9D61",
          }}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

export default function LiveDashboard({
  initialData,
  initialDays,
  initialProperty,
  firstName,
}: {
  initialData: DashboardData;
  initialDays: number;
  initialProperty: string;
  firstName: string;
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [days, setDays] = useState<number>(initialDays);
  const [property, setProperty] = useState<string>(initialProperty);
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("days", String(days));
      if (property !== "all") params.set("property", property);
      const res = await fetch(`/api/platform/valet/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // silently retry next interval
    }
  }, [days, property]);

  useEffect(() => {
    if (!polling) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [polling, fetchDashboard]);

  const { stats, byProperty, chart, live, properties } = data;
  const rangeLabel = days === 1 ? "today" : `last ${days} days`;
  const propertyName = properties.find((p) => p.id === Number(property))?.name || "";
  const maxCars = Math.max(...byProperty.map((p) => p.carsToday), 1);
  const validationPct = stats.carsParked ? Math.round((stats.offersValidated / stats.carsParked) * 100) : 0;

  const targetMin = 8;
  const speedDiff = targetMin - stats.avgReturnTime;
  const speedFast = speedDiff >= 0;

  const pct =
    stats.prevCarsParked > 0
      ? Math.round(((stats.carsParked - stats.prevCarsParked) / stats.prevCarsParked) * 100)
      : null;
  const deltaArrow = pct == null || pct >= 0 ? "▲" : "▼";
  const deltaText =
    pct == null
      ? "▲ New this period"
      : `${deltaArrow} ${Math.abs(pct)}% vs previous ${days === 1 ? "day" : `${days} days`}`;

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <style>{`@keyframes ws-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 className="flex items-center gap-2 text-title">
            {greeting}{firstName ? `, ${firstName}` : ""}
            <button
              type="button"
              onClick={() => setPolling((p) => !p)}
              aria-pressed={polling}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.3px",
                cursor: "pointer",
                border: "none",
                background: polling ? "#E7F7EF" : "#FDEBEB",
                color: polling ? "#0C9D61" : "#E23D3D",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                  animation: polling ? "ws-pulse 2s infinite" : "none",
                }}
              />
              {polling ? "Live" : "Offline"}
            </button>
          </h1>
          <p
            className="max-w-prose text-sm text-muted-foreground"
            style={{ color: "var(--text-secondary)", marginTop: 2, fontSize: 12.5, fontWeight: 600 }}
          >
            {dateStr} · {property === "all" ? "All properties healthy" : propertyName}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Select
              value={property}
              items={[{ value: "all", label: "All properties" }, ...properties.map((p) => ({ value: String(p.id), label: p.name }))]}
              onValueChange={(v) => setProperty(v ?? "all")}
            >
              <SelectTrigger className="h-[34px] rounded-full border-[1.5px] border-[#e7eaf0] bg-white px-4 text-[12.5px] font-bold text-[#1c2b46]">
                <span className="font-semibold text-[#6c7a93]">Property:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(days)}
              items={[
                { value: "1", label: "Today" },
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
              ]}
              onValueChange={(v) => setDays(Number(v ?? 7))}
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
            <Link
              href="/tenant-admin/locations"
              className="btn-primary inline-flex items-center gap-2"
              style={{ boxShadow: "0 4px 16px rgba(16,22,35,0.05)" }}
            >
              <PlusIcon className="size-4" />
              Add location
            </Link>
          </div>
        </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 22 }}>
        <StatCard
          label="Cars parked"
          icon={<CarIcon size={17} color="#F4531F" />}
          iconBg="#FEEFE8"
          value={<span style={{ color: "#16213a" }}>{stats.carsParked}</span>}
          delta={deltaText}
          deltaTone="up"
        />
        <StatCard
          label="Avg return time"
          icon={<ClockIcon size={17} color="#0C9D61" />}
          iconBg="#E7F7EF"
          value={<span style={{ color: "#16213a" }}>{fmtDuration(stats.avgReturnTime)}</span>}
          delta={`${speedFast ? "▼" : "▲"} ${fmtDuration(Math.abs(speedDiff))} ${speedFast ? "faster" : "slower"} than target`}
          deltaTone={speedFast ? "up" : "amber"}
        />
        <StatCard
          label="Offers validated"
          icon={<TagIcon size={17} color="#B97B17" />}
          iconBg="#FDF3E3"
          value={
            <span style={{ color: "#16213a" }}>
              {stats.offersValidated} <span style={{ fontSize: 15, color: "#6C7A93", fontWeight: 700 }}>({validationPct}%)</span>
            </span>
          }
          delta={`▲ AED ${stats.outletSpend.toLocaleString("en-GB")} outlet spend`}
          deltaTone="up"
        />
        <StatCard
          label="Drivers on shift"
          icon={<UsersIcon size={17} color="#4A5FC9" />}
          iconBg="#EDF0FE"
          value={
            <span style={{ color: "#16213a" }}>
              {stats.driversOnShift} <span style={{ fontSize: 15, color: "#6C7A93", fontWeight: 700 }}>/{stats.driversTotal}</span>
            </span>
          }
          delta={`${stats.overdue} overdue returns right now`}
          deltaTone="amber"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18, marginTop: 14 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E7EAF0",
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 20px 50px rgba(16,22,35,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#16213a" }}>
              Cars in &amp; out — {rangeLabel}
            </span>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: "#F4531F" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6C7A93" }}>Drop-offs</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: "#1C2B46" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6C7A93" }}>Returns</span>
              </div>
            </div>
          </div>
          <CarsInOutChart items={chart} />
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #E7EAF0",
            borderRadius: 16,
            padding: "20px 22px",
            boxShadow: "0 20px 50px rgba(16,22,35,0.06)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "#16213a" }}>By property — {rangeLabel}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 16 }}>
            {byProperty.map((p) => (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#48566E" }}>{p.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#16213a" }}>{p.carsToday}</span>
                </div>
                <div
                  style={{
                    background: "#F1F3F6",
                    borderRadius: 99,
                    height: 6,
                    marginTop: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 99,
                      width: `${Math.round((p.carsToday / maxCars) * 100)}%`,
                      background: p.color,
                      transition: "width .3s",
                    }}
                  />
                </div>
              </div>
            ))}
            {byProperty.length === 0 ? (
              <span style={{ fontSize: 13, color: "#6C7A93" }}>No locations yet.</span>
            ) : null}
          </div>
          {stats.overdue > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: "auto",
                paddingTop: 14,
                color: "#B97B17",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <AlertIcon size={16} color="#B97B17" />
              <span>{stats.overdue} returns overdue — check active valet queue</span>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #E7EAF0",
          borderRadius: 16,
          padding: "18px 22px",
          marginTop: 14,
          boxShadow: "0 20px 50px rgba(16,22,35,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "#16213a" }}>Live activity</span>
          <Link
            href="/tenant-admin/reports"
            style={{ fontSize: 12, fontWeight: 700, color: "#F4531F", cursor: "pointer" }}
          >
            Open reports →
          </Link>
        </div>
        {live.length === 0 ? (
          <div style={{ marginTop: 12, fontSize: 13, color: "#6C7A93" }}>No activity yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 26px", marginTop: 12 }}>
            {live.map((a, i) => (
              <div
                key={a.id || i}
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                  padding: "9px 0",
                  borderBottom: i < 2 ? "1px solid #F1F3F6" : "none",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: ACTIVITY_DOT[a.kind] || "#9AA6BC",
                    flex: "none",
                  }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: "#48566E" }}>
                  {a.action} — {a.plate} · {a.property}
                </span>
                <span style={{ fontSize: 11, color: "#9AA6BC", fontWeight: 600 }}>{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}