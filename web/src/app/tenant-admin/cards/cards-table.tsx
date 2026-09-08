"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, PrinterIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableFilter, type DataTableHeader } from "@/components/data-table";
import { CardTableRow } from "./card-row";
import { PrintDesignerDialog } from "./print-designer";
import type { CardTableItem, DeckInfo } from "../_lib/valet-data";

// #48 Step 3: client-side NFC card table with batch multi-select for the print
// designer. Uses the shared <DataTable> chrome (pill search + pill filters +
// console pagination, driven by URL params exactly like every other list page)
// while fetching list data through the same /api/platform/valet/cards endpoint
// the tenant cards page and SA org tab share. Selection state lives purely in
// the client so "tick several cards → pick a profile → export a batch PDF"
// works across pages without a server round-trip.
export function CardsTable({
  organizationId,
  canFreeze,
}: {
  organizationId?: string | null;
  canFreeze: boolean;
}) {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const getParam = (name: string) => searchParams.get(name) ?? "";

  const q = getParam("q");
  const status = getParam("status");
  const property = getParam("property");
  const page = Math.max(1, Number(getParam("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(getParam("pageSize")) || 15));
  const sortBy = getParam("sortBy") || "uid";
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

  const [items, setItems] = useState<CardTableItem[]>([]);
  const [properties, setProperties] = useState<{ id: number; name: string }[]>([]);
  const [deck, setDeck] = useState<DeckInfo | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [designerOpen, setDesignerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
      status: status || "all",
      property: property || "all",
    });
    if (q) params.set("q", q);
    if (organizationId) params.set("organizationId", organizationId);
    fetch(`/api/platform/valet/cards?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load cards"))))
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setProperties(
          (data.properties ?? []).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })),
        );
        setTotalCount(data.totalCount ?? 0);
        setDeck(data.deck ?? null);
        setSelected(new Set());
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;
        setItems([]);
        setTotalCount(0);
        toast.error("Failed to load cards.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, pageSize, sortBy, sortDir, status, property, q, organizationId, reloadKey]);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (items.every((c) => next.has(c.uid))) {
        items.forEach((c) => next.delete(c.uid));
      } else {
        items.forEach((c) => next.add(c.uid));
      }
      return next;
    });
  };

  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectedCards = items.filter((c) => selected.has(c.uid)).map((c) => ({ uid: c.uid, property: c.property }));

  const statusFilter: DataTableFilter = {
    name: "status",
    value: status,
    label: "Status",
    allLabel: "All statuses",
    options: [
      { value: "unassigned", label: "Unassigned" },
      { value: "assigned", label: "Assigned" },
      { value: "printed", label: "Printed" },
      { value: "defect", label: "Defect" },
      { value: "ready", label: "Ready" },
      { value: "with_guest", label: "With guest" },
      { value: "returned", label: "Returned" },
      { value: "blocked", label: "Blocked / Lost" },
    ],
  };

  const propertyFilter: DataTableFilter = {
    name: "property",
    value: property,
    label: "Property",
    allLabel: "All properties",
    options: [
      { value: "unassigned", label: "Unassigned (deck)" },
      ...properties.map((p) => ({ value: String(p.id), label: p.name })),
    ],
  };

  const selectAllNode =
    items.length > 0 ? (
      <label className="checkbox" aria-label="Select all on this page" style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          className="hidden"
          checked={items.every((c) => selected.has(c.uid))}
          onChange={toggleAll}
          onClick={(e) => e.stopPropagation()}
        />
        <span className={`checkbox-box${items.every((c) => selected.has(c.uid)) ? " checked" : ""}`}>
          <Check size={12} strokeWidth={3.5} color="#ffffff" />
        </span>
      </label>
    ) : null;

  const headers: DataTableHeader[] = [
    { key: "select", label: selectAllNode, className: "w-10" },
    { key: "uid", label: "UID", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "property", label: "Property", sortable: true },
    { key: "lastUsed", label: "Last used", sortable: true },
    { key: "uses", label: "Uses", sortable: true },
    { key: "order", label: "Last order" },
    { key: "actions", label: "Manage", className: "text-right" },
  ];

  return (
    <>
      {deck ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            background: "#f7f8fb",
            border: "1px solid #e6e9f2",
            borderRadius: 14,
            padding: "10px 16px",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#1c2b46",
          }}
        >
          <span style={{ color: "#4a5fc9" }}>Platform deck</span>
          <span className="deck-pill" style={{ background: "#edf0fe", color: "#4a5fc9", borderRadius: 99, padding: "3px 10px" }}>
            {deck.prefix} series
          </span>
          <span className="deck-pill" style={{ background: "#eef8ef", color: "#2e9e47", borderRadius: 99, padding: "3px 10px" }}>
            next {deck.nextUid}
          </span>
          <span className="deck-pill" style={{ background: "#fff4ea", color: "#d6430f", borderRadius: 99, padding: "3px 10px" }}>
            {deck.unassigned} unassigned
          </span>
          <span className="deck-pill" style={{ background: "#edf0fe", color: "#4a5fc9", borderRadius: 99, padding: "3px 10px" }}>
            {deck.assigned} assigned
          </span>
          <span className="deck-pill" style={{ background: "#efeff1", color: "#6c7a93", borderRadius: 99, padding: "3px 10px" }}>
            {deck.printed} printed
          </span>
          <span className="deck-pill" style={{ background: "#fdecec", color: "#e23d3d", borderRadius: 99, padding: "3px 10px" }}>
            {deck.defect} defect
          </span>
          <span className="deck-pill" style={{ background: "#eef4ff", color: "#1c5fb8", borderRadius: 99, padding: "3px 10px" }}>
            {deck.active} in use
          </span>
        </div>
      ) : null}

      <DataTable
        headers={headers}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        sortBy={sortBy}
        sortDir={sortDir}
        searchPlaceholder="Search card UID or property…"
        filters={[statusFilter, propertyFilter]}
        rightSlot={
          <>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={() => setDesignerOpen(true)}
                className="inline-flex items-center gap-2 rounded-[99px] bg-[#f4531f] px-5 py-2.5 text-[12.5px] font-extrabold text-white shadow-[0_4px_16px_rgba(16,22,35,0.05)] transition-colors hover:bg-[#d6430f]"
              >
                <PrinterIcon className="size-4" />
                Print selected ({selected.size})
              </button>
            ) : null}
          </>
        }
      >
        {loading ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-[13px] font-semibold text-[#9aa6bc]">
              Loading cards…
            </TableCell>
          </TableRow>
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-[13px] font-semibold text-[#9aa6bc]">
              No cards found.
            </TableCell>
          </TableRow>
        ) : (
          items.map((card) => (
            <CardTableRow
              key={card.id}
              card={card}
              canPrint={canFreeze}
              properties={properties}
              organizationId={organizationId}
              selectable
              selected={selected.has(card.uid)}
              onToggleSelect={toggleOne}
            />
          ))
        )}
      </DataTable>

      <PrintDesignerDialog
        open={designerOpen}
        onOpenChange={setDesignerOpen}
        cards={selectedCards}
        canFreeze={canFreeze}
        onFrozen={() => setReloadKey((k) => k + 1)}
      />
    </>
  );
}