import { requireIdentity } from "@/lib/auth/current-user";
import { parseListQueryParams } from "@/lib/list-query-params";
import { DataTable, type DataTableFilter } from "@/components/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { BarChart3Icon } from "lucide-react";
import { getReports } from "../_lib/valet-data";
import { ReportsExportButton, type ReportRow } from "./reports-export";

const AVG_TONE = { green: "#0C9D61", amber: "#E9A23B" };

function fmt(ms: string | number): string {
  return `${Math.floor(Number(ms) / 60)}:${String(Number(ms) % 60).padStart(2, "0")}`;
}

function avgTone(v: number, threshold: number): string {
  return v > threshold ? AVG_TONE.amber : AVG_TONE.green;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ddMMyyyy(isoStr: string): string {
  if (!isoStr) return "";
  return `${isoStr.slice(8, 10)}-${isoStr.slice(5, 7)}-${isoStr.slice(0, 4)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const raw = await searchParams;
  const today = new Date();
  const past = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
  const defaultFrom = iso(past);
  const defaultTo = iso(today);
  const from = typeof raw.dateFrom === "string" && raw.dateFrom ? raw.dateFrom : defaultFrom;
  const to = typeof raw.dateTo === "string" && raw.dateTo ? raw.dateTo : defaultTo;
  const property = typeof raw.property === "string" ? raw.property : "all";
  const listParams = parseListQueryParams(raw);

  const data = await getReports({ property, from, to, organizationId: identity.session.organizationId ?? null });

  const propertyFilter: DataTableFilter = {
    name: "property",
    value: property === "all" ? "" : property,
    label: "Property",
    allLabel: "All properties",
    options: data.properties.map((p) => ({ value: String(p.id), label: p.name })),
  };
  const periodFilter: DataTableFilter = {
    name: "date",
    kind: "dateRange",
    value: from,
    valueTo: to,
    label: "Period",
    allLabel: "",
    options: [],
  };

  const rows = data.rows;
  const allRows = listParams.q
    ? rows.filter((r) => {
        const hay = `${r.day} ${r.date}`.toLowerCase();
        return hay.includes(String(listParams.q).toLowerCase());
      })
    : rows;

  const page = listParams.page && listParams.page > 0 ? listParams.page : 1;
  const pageSize = listParams.pageSize && listParams.pageSize > 0 ? listParams.pageSize : 20;
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const pageRows = allRows.slice((page - 1) * pageSize, page * pageSize);

  const totals2 = {
    drop: pageRows.reduce((s, r) => s + r.dropOffs, 0),
    ret: pageRows.reduce((s, r) => s + r.returns, 0),
    avg: pageRows.length > 0 ? Math.round(pageRows.reduce((s, r) => s + r.avgMin, 0) / pageRows.length) : 0,
    avgPark: pageRows.length > 0 ? Math.round(pageRows.reduce((s, r) => s + r.avgParkMin, 0) / pageRows.length) : 0,
    overdue: pageRows.reduce((s, r) => s + r.overdue, 0),
    val: pageRows.reduce((s, r) => s + r.validations, 0),
    spend: pageRows.reduce((s, r) => s + r.spend, 0),
  };
  const valPct = totals2.drop ? Math.round((totals2.val / totals2.drop) * 100) : 0;
  const rangeText = `${ddMMyyyy(from)} – ${ddMMyyyy(to)} ${to.slice(0, 4)}`;
  const shortFirst = rows[0] ? `${rows[0].date.slice(8, 10)} ${rows[0].date.slice(5, 7)}` : "";
  const shortLast = rows[rows.length - 1] ? `${rows[rows.length - 1].date.slice(8, 10)} ${rows[rows.length - 1].date.slice(5, 7)}` : "";
  const shortRange = rows.length
    ? `${shortFirst} – ${shortLast} ${to.slice(0, 4)}`
    : rangeText;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<BarChart3Icon className="size-5" />}
        title="Reports"
        description="Drop-offs, returns, and validated spend across your properties."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <ReportsExportButton rows={rows as ReportRow[]} rangeLabel={shortRange} />
          </div>
        }
      />

      <DataTable
        headers={[
          { key: "date", label: "Day" },
          { key: "dropOffs", label: "Drop-offs", className: "text-right" },
          { key: "returns", label: "Returns", className: "text-right" },
          { key: "avgPark", label: "Avg park", className: "text-right" },
          { key: "avgReturn", label: "Avg return", className: "text-right" },
          { key: "overdue", label: "Overdue", className: "text-right" },
          { key: "validations", label: "Validations", className: "text-right" },
          { key: "spend", label: "Outlet spend", className: "text-right" },
        ]}
        page={page}
        pageSize={pageSize}
        totalCount={allRows.length}
        totalPages={totalPages}
        searchPlaceholder="Search day or date…"
        filters={[propertyFilter, periodFilter]}
      >
        {pageRows.map((r) => (
          <TableRow key={r.date}>
            <TableCell className="text-[12.5px] font-extrabold text-[#1c2b46]">
              {r.isToday ? (
                <span className="flex items-center gap-2">
                  {r.day} {r.date.slice(5)}{" "}
                  <span className="rounded-full bg-[#FDEBEB] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#F4531F]">
                    Today
                  </span>
                </span>
              ) : (
                <span>
                  {r.day} {r.date.slice(5)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-bold text-[#48566e]">{r.dropOffs}</TableCell>
            <TableCell className="text-right text-[12.5px] font-bold text-[#48566e]">{r.returns}</TableCell>
            <TableCell
              className="text-right text-[12.5px] font-extrabold"
              style={{ color: avgTone(r.avgParkMin, 10) }}
            >
              {fmt(r.avgParkMin)}
            </TableCell>
            <TableCell
              className="text-right text-[12.5px] font-extrabold"
              style={{ color: avgTone(r.avgMin, 8) }}
            >
              {fmt(r.avgMin)}
            </TableCell>
            <TableCell
              className="text-right text-[12.5px] font-bold"
              style={{ color: r.overdue > 8 ? "#E23D3D" : "#1C2B46" }}
            >
              {r.overdue}
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-bold text-[#48566e]">
              {r.validations}
              {r.dropOffs ? ` (${Math.round((r.validations / r.dropOffs) * 100)}%)` : ""}
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold text-[#1C2B46]">AED {r.spend.toLocaleString("en-GB")}</TableCell>
          </TableRow>
        ))}

        {rows.length > 0 ? (
          <TableRow className="border-t-2 border-[#edeff3] bg-[#fafbfc]">
            <TableCell className="text-[12.5px] font-extrabold text-[#1c2b46]">Period total</TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold text-[#1c2b46]">{totals2.drop.toLocaleString("en-GB")}</TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold text-[#1c2b46]">{totals2.ret.toLocaleString("en-GB")}</TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold" style={{ color: "#0C9D61" }}>
              {fmt(totals2.avgPark)}
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold" style={{ color: "#0C9D61" }}>
              {fmt(totals2.avg)}
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold text-[#1c2b46]">{totals2.overdue}</TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold text-[#1c2b46]">
              {totals2.val} ({valPct}%)
            </TableCell>
            <TableCell className="text-right text-[12.5px] font-extrabold" style={{ color: "#F4531F" }}>
              AED {totals2.spend.toLocaleString("en-GB")}
            </TableCell>
          </TableRow>
        ) : null}
        {data.rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
              No data in this range.
            </TableCell>
          </TableRow>
        ) : pageRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
              No days match your search.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>

      <p className="text-[11.5px] font-semibold text-[#9aa6bc]">
        {shortRange} · Columns are per selected property or aggregated. “Outlet spend” = revenue
        at hotel outlets attributed to valet-validated visits — the number that sells this system to hotels.
      </p>
    </div>
  );
}
