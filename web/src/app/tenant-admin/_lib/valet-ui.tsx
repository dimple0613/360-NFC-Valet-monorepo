export function fmtDuration(totalMin: number): string {
  const m = Math.max(0, totalMin || 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDateTime(ts: Date | string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CardStatusBadge({ status, tone }: { status: string; tone: string }) {
  const color =
    tone === "green" ? "#0C9D61" : tone === "orange" ? "#F4531F" : tone === "amber" ? "#B97B17" : "#E23D3D";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.4px]"
      style={{ background: `${color}14`, color }}
    >
      {status}
    </span>
  );
}

export function DriverStatusBadge({ status }: { status: string }) {
  const color =
    status === "on_shift" ? "#0C9D61" : status === "on_break" ? "#B97B17" : status === "off_duty" ? "#9AA6BC" : "#E23D3D";
  const label =
    status === "on_shift" ? "On Shift" : status === "on_break" ? "On Break" : status === "off_duty" ? "Off Duty" : "Removed";
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

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
