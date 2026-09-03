"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Page-local search/sort/pagination chrome for row-list screens (Customers,
// and the org detail page's Users/Subscriptions tabs) — a deliberate
// divergence from the shared DataTable component (which every other list
// screen keeps using unchanged): these pages' toolbar/footer placement
// matches a specific reference design, not DataTable's convention.
// `paramPrefix` namespaces URL params (same convention as DataTable's own
// paramPrefix) so more than one of these can live on one page — e.g. the org
// detail page's Users and Subscriptions tabs, both mounted at once by Tabs.

const ORGANIZATION_SORT_FIELDS = [
  { value: "createdAt", label: "Created at" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
];

const SEARCH_DEBOUNCE_MS = 300;

function usePushParams(paramPrefix: string) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const key = (name: string) => `${paramPrefix}${name}`;

  return function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(updates)) {
      if (value === null) next.delete(key(name));
      else next.set(key(name), value);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function CustomerListToolbar({
  sortBy,
  sortDir,
  rightSlot,
  paramPrefix = "",
  sortFields = ORGANIZATION_SORT_FIELDS,
  filters = [],
}: {
  sortBy: string;
  sortDir: "asc" | "desc";
  rightSlot?: React.ReactNode;
  paramPrefix?: string;
  sortFields?: { value: string; label: string }[];
  filters?: {
    name: string;
    value: string;
    label: string;
    allLabel: string;
    options: { value: string; label: string }[];
  }[];
}) {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const pushParams = usePushParams(paramPrefix);
  const [searchInput, setSearchInput] = useState(searchParams.get(`${paramPrefix}q`) ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput === (searchParams.get(`${paramPrefix}q`) ?? "")) return;
      pushParams({ q: searchInput || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="sortBy"
          value={sortBy}
          items={sortFields}
          onValueChange={(value) => pushParams({ sortBy: String(value), page: null })}
        >
          <SelectTrigger className="h-8">
            <span className="text-muted-foreground">Sort by</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortFields.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={sortDir === "asc" ? "Sort descending" : "Sort ascending"}
          onClick={() => pushParams({ sortDir: sortDir === "asc" ? "desc" : "asc" })}
        >
          {sortDir === "asc" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}
        </Button>
        {filters.map((filter) => (
          <Select
            key={filter.name}
            name={filter.name}
            value={filter.value || "all"}
            items={[{ value: "all", label: filter.allLabel }, ...filter.options]}
            onValueChange={(value) => pushParams({ [filter.name]: value === "all" ? null : String(value), page: null })}
          >
            <SelectTrigger className="h-8">
              <span className="text-muted-foreground">{filter.label}</span>
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
        ))}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Type to search..."
            className="w-56 pl-8"
          />
        </div>
      </div>
      {rightSlot}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [
  { value: "15", label: "15" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

export function CustomerListFooter({
  page,
  pageSize,
  totalCount,
  totalPages,
  paramPrefix = "",
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  paramPrefix?: string;
}) {
  const pushParams = usePushParams(paramPrefix);
  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Select
          name="pageSize"
          value={String(pageSize)}
          items={PAGE_SIZE_OPTIONS}
          onValueChange={(value) => pushParams({ pageSize: String(value), page: null })}
        >
          <SelectTrigger className="h-8 w-16">
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
          items per page &middot; From {from} to {to}. Total {totalCount} records
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => pushParams({ page: String(page - 1) })}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => pushParams({ page: String(page + 1) })}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
