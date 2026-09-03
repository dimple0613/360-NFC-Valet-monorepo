"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { DownloadIcon } from "lucide-react";

export interface ReportRow {
  day: string;
  date: string;
  dropOffs: number;
  returns: number;
  avgMin: number;
  avgParkMin: number;
  overdue: number;
  validations: number;
  spend: number;
  isToday: boolean;
}

function ddMMyyyy(isoStr: string): string {
  if (!isoStr) return "";
  return `${isoStr.slice(8, 10)}-${isoStr.slice(5, 7)}-${isoStr.slice(0, 4)}`;
}

function fmtDuration(totalMin: number): string {
  const m = Math.max(0, totalMin || 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function exportCsv(rows: ReportRow[]) {
  const head = "Day,Drop-offs,Returns,Avg park (min),Avg return (min),Overdue,Validations,Outlet spend";
  const body = rows
    .map((r) =>
      [`${r.day} ${ddMMyyyy(r.date)}`, r.dropOffs, r.returns, r.avgParkMin, r.avgMin, r.overdue, r.validations, r.spend].join(",")
    )
    .join("\n");
  const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "360nfc-valet-reports.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPdf(rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor("#1C2B46");
  doc.text("360 NFC Valet — Daily report", margin, 48);

  const first = rows[0]?.date ?? "";
  const last = rows[rows.length - 1]?.date ?? "";
  const sub = first
    ? `${first.slice(8, 10)}-${first.slice(5, 7)} – ${last?.slice(8, 10)}-${last?.slice(5, 7)}`
    : "";
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor("#6C7A93");
    doc.text(sub, margin, 66);
  }

  const headers = ["Day", "Drop-offs", "Returns", "Avg park", "Avg return", "Overdue", "Validations", "Outlet spend"];

  const colW = (pageWidth - margin * 2) / headers.length;
  const rowH = 24;
  let y = 92;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#6C7A93");
  doc.setFillColor("#FAFBFC");
  doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
  doc.setTextColor("#6C7A93");
  headers.forEach((h, i) => {
    doc.text(h, margin + colW * i + 10, y + 16);
  });
  y += rowH;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#1C2B46");

  rows.forEach((r) => {
    doc.setDrawColor("#EDEFF3");
    doc.line(margin, y, pageWidth - margin, y);
    const values: (string | number)[] = [
      `${r.day} ${ddMMyyyy(r.date)}`,
      r.dropOffs,
      r.returns,
      r.avgParkMin ? fmtDuration(r.avgParkMin) : "—",
      r.avgMin ? fmtDuration(r.avgMin) : "—",
      r.overdue,
      r.validations,
      `AED ${r.spend.toLocaleString()}`,
    ];
    values.forEach((v, i) => {
      doc.text(String(v), margin + colW * i + 10, y + 16);
    });
    y += rowH;
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 60;
    }
  });

  doc.save("360nfc-valet-reports.pdf");
}

export function ReportsExportButton({ rows, rangeLabel }: { rows: ReportRow[]; rangeLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-[#16213a] px-5 text-[12.5px] font-bold text-white transition hover:bg-[#1f2d4f]"
      >
        <DownloadIcon className="size-4" />
        Export CSV / PDF
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_20px_50px_rgba(16,22,35,0.12)]">
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-[12.5px] font-bold text-[#1c2b46] hover:bg-[#f6f7f9]"
              onClick={() => {
                exportCsv(rows);
                setOpen(false);
              }}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="block w-full border-t border-[#edeff3] px-4 py-2.5 text-left text-[12.5px] font-bold text-[#1c2b46] hover:bg-[#f6f7f9]"
              onClick={() => {
                exportPdf(rows);
                setOpen(false);
              }}
            >
              Export PDF
            </button>
            {rangeLabel ? (
              <div className="border-t border-[#edeff3] bg-[#fafbfc] px-4 py-2 text-[11px] font-semibold text-[#9aa6bc]">
                {rangeLabel}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
