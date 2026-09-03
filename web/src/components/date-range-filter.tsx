"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { ChevronDown, XIcon } from "lucide-react";

const PRESETS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseISO(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DateRangeFilterButton({
  label,
  value,
  valueTo,
  onChange,
}: {
  label: string;
  value: string;
  valueTo: string;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scratch, setScratch] = useState<Partial<DateRange> | undefined>(undefined);

  const hasRange = Boolean(value && valueTo);
  const sel = value && valueTo ? { from: parseISO(value), to: parseISO(valueTo) } : undefined;
  const selected = (open && scratch ? scratch : sel) as DateRange | undefined;

  const displayValue = hasRange
    ? `${format(parseISO(value), "d MMM yyyy")} – ${format(parseISO(valueTo), "d MMM yyyy")}`
    : "All";

  function applyPreset(days: number) {
    const t = startOfDay(new Date());
    const f = new Date(t.getTime() - (days - 1) * 86400000);
    onChange(toISO(f), toISO(t));
    setScratch(undefined);
    setOpen(false);
  }

  function clear() {
    onChange(null, null);
    setScratch(undefined);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[99px] border-[1.5px] border-border bg-card px-4 py-[9px] whitespace-nowrap transition-[border-color,box-shadow] duration-150 cursor-pointer hover:border-primary hover:shadow-[0_0_0_3px_var(--accent)]"
      >
        <span className="text-[12.5px] font-semibold text-[#6c7a93]">{label}:</span>
        <span className="text-[12.5px] font-bold text-[#1c2b46]">{displayValue}</span>
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[80] top-[calc(100%+8px)] flex overflow-hidden rounded-[14px] border border-border bg-popover shadow-[0_20px_50px_rgba(16,22,35,0.18)]">
            <div className="flex flex-col gap-0.5 border-r border-border bg-background p-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="rounded-lg bg-none px-3 py-2 text-left whitespace-nowrap transition-colors duration-150 cursor-pointer hover:bg-card text-[12.5px] font-bold text-foreground"
                >
                  {p.label}
                </button>
              ))}
              {hasRange ? (
                <>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={clear}
                    className="flex items-center gap-1.5 rounded-lg bg-none px-3 py-2 text-left whitespace-nowrap transition-colors duration-150 cursor-pointer hover:bg-card text-[12.5px] font-bold text-muted-foreground"
                  >
                    <XIcon size={13} />
                    Clear
                  </button>
                </>
              ) : null}
            </div>
            <div className="cbl-date-range p-3">
              <DayPicker
                mode="range"
                selected={selected}
                onSelect={(next) => {
                  if (next?.from && next?.to) {
                    onChange(toISO(next.from), toISO(next.to));
                    setScratch(undefined);
                    setOpen(false);
                  } else {
                    setScratch(next);
                  }
                }}
                numberOfMonths={2}
                defaultMonth={sel?.from || new Date()}
              />
            </div>
          </div>
          <style>{`
            .cbl-date-range .rdp-root { margin: 0; --rdp-accent-color: var(--primary); --rdp-accent-background-color: #fdeee9; --rdp-today-color: var(--primary); --rdp-months-gap: 10px; --rdp-day-width: 34px; --rdp-day-height: 34px; --rdp-day_button-width: 32px; --rdp-day_button-height: 32px; /* --rdp-day_button-border-radius: 8px; */ }
            .cbl-date-range .rdp-caption_label {
              font-size: 13px !important;
              font-weight: 800 !important;
              color: var(--foreground) !important;
              padding: 0 4px !important;
            }
            .cbl-date-range .rdp-chevron { fill: var(--muted-foreground) !important; }
            .cbl-date-range .rdp-day_button {
              font-size: 12.5px !important;
              font-weight: 700 !important;
            }
            .cbl-date-range .rdp-day_button:hover:not(:disabled) {
              /* background: #f6f7f9 !important; */
            }
            .cbl-date-range .rdp-selected { font-size: inherit !important; }
            .cbl-date-range .rdp-selected .rdp-day_button {
              /* background: var(--primary) !important;
              color: #ffffff !important; */
            }
            .cbl-date-range .rdp-range_middle {
              /* background-color: var(--primary) !important;
              color: var(--primary-foreground) !important; */
            }
            .cbl-date-range .rdp-range_start .rdp-day_button,
            .cbl-date-range .rdp-range_end .rdp-day_button {
              /* background-color: var(--primary) !important;
              color: #ffffff !important; */
            }
            .cbl-date-range .rdp-outside { opacity: 0.4 !important; }
          `}</style>
        </>
      ) : null}
    </div>
  );
}
