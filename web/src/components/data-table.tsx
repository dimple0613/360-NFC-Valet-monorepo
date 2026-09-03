"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, SearchIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilterButton } from "@/components/date-range-filter";

// Server Components can pass pre-rendered JSX as `children` into a Client
// Component (that's just React elements, serializable), but NOT functions —
// an earlier version of this component took `columns: { render: (row) => JSX
// }[]` as a prop and broke with "Functions cannot be passed directly to
// Client Components" the moment a Server Component page tried to use it.
// This version instead takes plain-data column headers (for the sortable
// click targets) and the actual <TableRow> markup as `children`, built by
// the caller (a Server Component) exactly like every other table in this
// codebase already does.

export interface DataTableHeader {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
}

export type DataTableFilterKind = "select" | "dateRange";

export interface DataTableFilter {
  name: string;
  value: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  /** `select` (default) writes one URL key (`name`); `dateRange` writes two (`nameFrom`/`nameTo`) with `value`/`valueTo` driving them. */
  kind?: DataTableFilterKind;
  /** Upper bound for `dateRange` filters — the `valueTo` half of the range. */
  valueTo?: string;
}

export interface DataTableProps {
  headers: DataTableHeader[];
  children: React.ReactNode;
  page: number;
  pageSize?: number;
  totalCount: number;
  totalPages: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** Namespaces this table's URL params so more than one DataTable can live on the same page. */
  paramPrefix?: string;
  searchPlaceholder?: string;
  /** Optional column-header sort is driven by `headers[].sortable`; extra value filters render as pill selects in the toolbar. */
  filters?: DataTableFilter[];
  /** Content rendered on the toolbar's right side (e.g. a "New" button). */
  rightSlot?: React.ReactNode;
  /** Smaller chrome for embedding inside a Card (e.g. a role's assignee list) rather than a full page. */
  compact?: boolean;
  /** Hide the search box (e.g. when the list has no search or search lives in the page header beside the table). */
  hideSearch?: boolean;
  /** Hide the footer pagination + page-size select (e.g. short, non-paginated lists). */
  hidePagination?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

// The console (Palette 1) neutral treatment: pill search + row-count toolbar,
// an uppercase, tight letter-spaced header on #fafbfc, and a footer with a
// page-size select + "items per page · From X to Y. Total N records" on the
// left and the console's centered page-number pagination on the right. Colours
// match the console's DataTable exactly (see valet/styles/globals.css).

const PAGE_SIZE_OPTIONS = [
  { value: "15", label: "15" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function SortIdle() {
  return <span className="opacity-30 text-[11px] leading-none">&#8597;</span>;
}

export function DataTable({
  headers,
  children,
  page,
  pageSize = 15,
  totalCount,
  totalPages,
  sortBy,
  sortDir,
  paramPrefix = "",
  searchPlaceholder = "Search...",
  filters = [],
  rightSlot,
  compact = false,
  hideSearch = false,
  hidePagination = false,
}: DataTableProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const key = (name: string) => `${paramPrefix}${name}`;

  const [searchInput, setSearchInput] = useState(searchParams.get(key("q")) ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(updates)) {
      if (value === null) next.delete(key(name));
      else next.set(key(name), value);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput === (searchParams.get(key("q")) ?? "")) return;
      pushParams({ q: searchInput || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function toggleSort(columnKey: string) {
    const nextDir = sortBy === columnKey && sortDir === "asc" ? "desc" : "asc";
    pushParams({ sortBy: columnKey, sortDir: nextDir, page: null });
  }

  function goToPage(nextPage: number) {
    pushParams({ page: String(nextPage) });
  }

  function changePageSize(nextSize: string | null) {
    if (nextSize) pushParams({ pageSize: nextSize, page: null });
  }

  const pageNumbers = getPageNumbers(page, totalPages);
  const sortedCol = sortBy ?? "";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="console-dt flex flex-col gap-0">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {!hideSearch ? (
              <div className="flex items-center gap-2 border-[1.5px] border-[#e7eaf0] bg-white rounded-full p-[9px_16px] text-[12.5px] font-semibold text-[#6c7a93] w-full max-w-xs">
                <SearchIcon className="size-3.5 text-[#6c7a93]" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="bg-transparent border-none outline-none text-[12.5px] font-semibold text-[#1c2b46] placeholder:text-[#9aa6bc] w-full"
                />
              </div>
            ) : null}
            {filters.map((filter) =>
              filter.kind === "dateRange" ? (
                <DateRangeFilterButton
                  key={filter.name}
                  label={filter.label}
                  value={filter.value ?? ""}
                  valueTo={filter.valueTo ?? ""}
                  onChange={(from, to) =>
                    pushParams({
                      [`${filter.name}From`]: from,
                      [`${filter.name}To`]: to,
                      page: null,
                    })
                  }
                />
              ) : (
                <Select
                  key={filter.name}
                  name={filter.name}
                  value={filter.value || "all"}
                  items={[{ value: "all", label: filter.allLabel }, ...filter.options]}
                  onValueChange={(value) =>
                    pushParams({ [filter.name]: value === "all" ? null : String(value), page: null })
                  }
                >
                  <SelectTrigger className="h-[34px] rounded-full border-[1.5px] border-[#e7eaf0] bg-white px-4 text-[12.5px] font-bold text-[#1c2b46]">
                    <span className="font-semibold text-[#6c7a93]">{filter.label}:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{filter.allLabel}</SelectItem>
                    {filter.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ),
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-[#9aa6bc] whitespace-nowrap">
              {totalCount} {totalCount === 1 ? "row" : "rows"}
            </span>
            {rightSlot}
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-[#e7eaf0] rounded-[18px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th
                    key={header.key}
                    className={`px-4 py-3 text-[10.5px] font-extrabold uppercase tracking-[1.2px] text-[#6c7a93] bg-[#fafbfc] border-b border-[#edeff3] text-left whitespace-nowrap select-none ${
                      header.sortable ? "cursor-pointer hover:text-[#f4531f]" : ""
                    } ${sortedCol === header.key ? "text-[#f4531f]" : ""} ${header.className ?? ""}`}
                    onClick={() => (header.sortable ? toggleSort(header.key) : undefined)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.label}
                      {header.sortable ? (
                        sortedCol === header.key ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )
                        ) : (
                          <SortIdle />
                        )
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>

        {!hidePagination && totalCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#edeff3]">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#6c7a93]">
              <Select name="pageSize" value={String(pageSize)} items={PAGE_SIZE_OPTIONS} onValueChange={changePageSize}>
                <SelectTrigger className="h-8 w-16 border-[1.5px] border-[#e7eaf0] bg-white text-[12.5px] font-bold text-[#1c2b46]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>
                items per page · From {from} to {to}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <span className="mr-1 text-[12px] font-bold text-[#6c7a93]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="inline-flex items-center justify-center size-8 rounded-lg border border-[#e7eaf0] bg-white text-[#1c2b46] cursor-pointer transition-all hover:bg-[#f6f7f9] hover:border-[#f4531f] hover:text-[#f4531f] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="inline-flex items-center justify-center w-6 text-[13px] text-[#9aa6bc]">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p as number)}
                    className={`inline-flex items-center justify-center min-w-8 h-8 px-1.5 rounded-lg border text-[12px] font-bold cursor-pointer transition-all ${
                      p === page
                        ? "bg-[#f4531f] text-white border-[#f4531f]"
                        : "border-transparent bg-transparent text-[#6c7a93] hover:bg-[#f6f7f9] hover:text-[#1c2b46]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="inline-flex items-center justify-center size-8 rounded-lg border border-[#e7eaf0] bg-white text-[#1c2b46] cursor-pointer transition-all hover:bg-[#f6f7f9] hover:border-[#f4531f] hover:text-[#f4531f] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>
  );
}
