"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, XIcon, TagIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { OfferForm } from "./offer-form";
import type { OfferTableItem } from "../_lib/valet-data";
import { PageHeader } from "@/components/page-header";
import { connectAuthedWs } from "@/lib/ws";

const GUEST_BASE = process.env.NEXT_PUBLIC_GUEST_BASE || "http://localhost:3001";
const GUEST_SAMPLE_UID = process.env.NEXT_PUBLIC_GUEST_SAMPLE_UID || "7001";

export function OffersManager({
  initialOffers,
  fields,
}: {
  initialOffers: OfferTableItem[];
  fields: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [property, setProperty] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<OfferTableItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OfferTableItem | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = connectAuthedWs();
      if (ws) {
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);
      }
    } catch {
      /* leave disconnected */
    }
    return () => ws?.close();
  }, []);

  const offers = initialOffers;

  const selectedPropertyName = useMemo(() => {
    if (property === "all") return "All properties";
    return fields.find((p) => String(p.id) === property)?.name ?? "";
  }, [property, fields]);

  const scopedOffers = useMemo(() => {
    if (property === "all") return offers;
    return offers.filter((o) => String(o.propertyId) === property);
  }, [offers, property]);

  const categories = useMemo(() => [...new Set(scopedOffers.map((o) => o.category).filter(Boolean))] as string[], [scopedOffers]);

  const featuredOffers = useMemo(() => {
    const bySlot: Record<number, OfferTableItem> = {};
    scopedOffers.forEach((o) => {
      if (o.featured === 1 || o.featured === 2) bySlot[o.featured] = o;
    });
    return bySlot;
  }, [scopedOffers]);

  const filtered = useMemo(() => {
    if (filter === "All") return scopedOffers;
    return scopedOffers.filter((o) => o.category === filter);
  }, [scopedOffers, filter]);

  function call(body: Record<string, unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/offers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        toast.success(successMsg);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function setFeatured(id: number, slot: number | null) {
    call({ id, featured: slot }, slot ? "Offer featured on guest page." : "Offer removed from featured.");
  }

  function onDrop(slot: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id) setFeatured(Number(id), slot);
  }

  function toggle(o: OfferTableItem) {
    const live = !o.live;
    call({ id: o.id, live, draft: false }, live ? `${o.title} is live.` : `${o.title} is hidden.`);
  }

  function toggleDraft(o: OfferTableItem) {
    const publish = o.draft;
    call({ id: o.id, draft: !o.draft, live: publish }, publish ? `${o.title} published.` : `${o.title} moved to draft.`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    call({ id: deleteTarget.id, remove: true }, "Offer deleted.");
    setDeleteTarget(null);
  }

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={{ flex: 1.5, minWidth: 0 }}>
        <div className="flex items-center gap-4 flex-wrap" style={{ justifyContent: "space-between" }}>
          <PageHeader
            icon={<TagIcon className="size-5" />}
            title="Offers & promotions"
            titleTrailing={
              selectedPropertyName ? (
                <span style={{ fontSize: 14, color: "#6C7A93", fontWeight: 700, whiteSpace: "nowrap" }}>
                  · {selectedPropertyName}
                </span>
              ) : undefined
            }
            description={
              <span style={{ fontSize: 11.5, fontWeight: 500 }}>
                Create and manage guest-facing offers, deals, and outlet promotions.
              </span>
            }
          />
          {connected && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide"
              style={{ color: "#0C9D61" }}
            >
              <span className="size-1.5 rounded-full" style={{ background: "#0C9D61" }} />
              Live
            </span>
          )}
          <div className="flex items-center gap-2.5">
            <Select
              value={property}
              onValueChange={(v) => setProperty(v ?? "all")}
            >
              <SelectTrigger className="h-[34px] rounded-full border-[1.5px] border-[#e7eaf0] bg-white px-4 text-[12.5px] font-bold text-[#1c2b46]">
                <span className="font-semibold text-[#6c7a93]">Property:</span>
                <span className="font-bold text-[#1c2b46]">{selectedPropertyName || "All properties"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {fields.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2"
              style={{
                background: "#f4531f",
                color: "#fff",
                borderRadius: 99,
                padding: "10px 20px",
                fontSize: 12.5,
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
                transition: "background 0.15s ease",
                border: "none",
                cursor: "pointer",
              }}
            >
              <PlusIcon className="size-4" />
              New offer
            </button>
          </div>
        </div>

        <div className="flex items-center" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Pill active={filter === "All"} onClick={() => setFilter("All")}>
            All · {scopedOffers.length}
          </Pill>
          {categories.map((c) => (
            <Pill key={c} active={filter === c} onClick={() => setFilter(c)}>
              {c} · {scopedOffers.filter((o) => o.category === c).length}
            </Pill>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
          {filtered.map((o) => (
            <div
              key={o.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(o.id))}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                padding: "14px 18px",
                cursor: "grab",
                borderRadius: 16,
                border: "1px solid #e7eaf0",
                background: o.live ? "#fff" : "#FAFBFC",
                boxShadow: "0 20px 50px rgba(16,22,35,0.04)",
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 64,
                  borderRadius: 12,
                  flexShrink: 0,
                  backgroundImage: o.imageUrl ? `url(${o.imageUrl})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: o.imageUrl ? undefined : "#F1F3F6",
                }}
              >
                {!o.imageUrl && <span style={{ fontSize: 10, color: "#9AA6BC", fontWeight: 600 }}>no img</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-extrabold text-[#1c2b46]">{o.title}</span>
                  {o.featured && (
                    <span
                      className="text-[10px] font-extrabold"
                      style={{
                        background: "#FEefe8",
                        color: "#D6430F",
                        whiteSpace: "nowrap",
                        borderRadius: 99,
                        padding: "5px 12px",
                        fontSize: 10.5,
                        fontWeight: 800,
                        display: "inline-flex",
                      }}
                    >
                      FEATURED #{o.featured}
                    </span>
                  )}
                  {o.menuUrl && (
                    <span
                      className="text-[10px] font-extrabold"
                      style={{
                        background: "#EDF0FE",
                        color: "#4A5FC9",
                        whiteSpace: "nowrap",
                        borderRadius: 99,
                        padding: "5px 12px",
                        fontSize: 10.5,
                        fontWeight: 800,
                        display: "inline-flex",
                      }}
                    >
                      menu
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] font-semibold text-[#6c7a93] mt-0.5">
                  {o.category} · AED {o.price}
                  {o.wasPrice ? ` (was AED ${o.wasPrice})` : ""}
                  {o.validatesValet ? " · validates valet" : ""}
                  {o.property ? ` · ${o.property}` : ""}
                </div>
                {o.desc && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6C7A93",
                      marginTop: 3,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 500,
                    }}
                  >
                    {o.desc}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", minWidth: 72 }}>
                <div className="text-[16px] font-extrabold text-[#1c2b46]">
                  {o.draft ? "—" : o.views7d.toLocaleString()}
                </div>
                <div className="text-[10px] font-semibold text-[#9aa6bc]">
                  {o.draft ? "draft — not visible" : "views · 7d"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {o.draft ? (
                  <ActionBtn color="#0C9D61" bg="#E7F7EF" onClick={() => toggleDraft(o)}>
                    Publish
                  </ActionBtn>
                ) : null}
                <ActionBtn color="#4A5FC9" bg="#EDF0FE" onClick={() => setEditing(o)}>
                  Edit
                </ActionBtn>
                <ActionBtn color="#C0392B" bg="#FEEFE8" onClick={() => setDeleteTarget(o)}>
                  Delete
                </ActionBtn>
                <div
                  onClick={() => toggle(o)}
                  style={{
                    width: 34,
                    height: 19,
                    borderRadius: 99,
                    background: o.live ? "#0C9D61" : "#D9DEE7",
                    padding: 2,
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: o.live ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#fff" }} />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ borderRadius: 16, border: "1px solid #e7eaf0", background: "#fff", padding: 20 }}>
              <span style={{ color: "#6C7A93", fontSize: 12.5, fontWeight: 600 }}>No offers in this category.</span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          width: 330,
          flex: "none",
          alignSelf: "flex-start",
          borderRadius: 20,
          border: "1px solid #e7eaf0",
          background: "#fff",
          padding: 20,
          boxShadow: "0 20px 50px rgba(16,22,35,0.05)",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#1c2b46" }}>Guest page preview</div>
        <div style={{ fontSize: 11, color: "#6C7A93", fontWeight: 600, marginTop: 2 }}>
          Exactly what a card tap shows, live.
        </div>
        <div style={{ marginTop: 14, border: "1.5px solid #E7EAF0", borderRadius: 18, overflow: "hidden" }}>
          <div
            style={{
              height: 92,
              background: "#F1F3F6",
              borderBottom: "1px dashed #C3CAD6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9AA6BC",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Banner slot
          </div>
          <div style={{ padding: "10px 12px" }}>
            <a
              href={`${GUEST_BASE}/t/${GUEST_SAMPLE_UID}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                height: 34,
                borderRadius: 99,
                background: "linear-gradient(135deg,#F4531F,#FF8A50)",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 6px 16px rgba(244,83,31,.28)",
              }}
              title="Open the live guest page"
            >
              Bring my car
            </a>
            <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ flex: 1, height: 30, borderRadius: 9, background: i === 0 ? "#FEEFE8" : "#F6F7F9" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              {[1, 2].map((slot) => {
                const f = featuredOffers[slot];
                const isOver = dragOver === slot;
                return (
                  <div
                    key={slot}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(slot);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => onDrop(slot, e)}
                    onClick={() => f && setFeatured(f.id, null)}
                    title={f ? "Click to remove from featured" : "Drag an offer here"}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 8px",
                      fontSize: 10,
                      fontWeight: 800,
                      textAlign: "center",
                      background: f ? "#FEEFE8" : "#F1F3F6",
                      border: f ? "1.5px solid #F4A47E" : "1.5px dashed #C3CAD6",
                      color: f ? "#D6430F" : "#9AA6BC",
                      cursor: f ? "pointer" : "grab",
                      outline: isOver ? "2px solid #F4531F" : "none",
                      transition: "outline 0.1s ease",
                    }}
                  >
                    {f ? f.title : `Featured ${slot === 1 ? "#1" : "#2"}`}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#6C7A93", fontWeight: 600, marginTop: 12, lineHeight: 1.6 }}>
          Drag offers into the two featured boxes. Banner, categories and listings update on guests&apos; phones
          immediately.
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent
          className="sm:max-w-[480px] overflow-y-auto"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24, maxHeight: "88vh" }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">New offer</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                Create a new offer for guests to redeem.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#f6f7f9",
                color: "#6c7a93",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "absolute",
                right: 10,
                top: 10,
              }}
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="super-console">
            <OfferForm
              fields={fields}
              submitLabel="Create & publish"
              onSuccess={() => {
                setShowNew(false);
                router.refresh();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          className="sm:max-w-[480px] overflow-y-auto"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24, maxHeight: "88vh" }}
        >
          {editing && (
            <>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="text-[17px] font-extrabold text-[#1c2b46]">Edit offer</div>
                  <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">Update {editing.title}.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  aria-label="Close"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "#f6f7f9",
                    color: "#6c7a93",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    position: "absolute",
                    right: 10,
                    top: 10,
                  }}
                >
                  <XIcon size={16} />
                </button>
              </div>
              <div className="super-console">
                <OfferForm
                  offerId={editing.id}
                  fields={fields}
                  submitLabel="Save changes"
                  defaults={{
                    title: editing.title,
                    category: editing.category ?? "",
                    price: editing.price.toString(),
                    wasPrice: editing.wasPrice == null ? "" : editing.wasPrice.toString(),
                    propertyId: editing.propertyId ? String(editing.propertyId) : fields[0] ? String(fields[0].id) : "",
                    imageUrl: editing.imageUrl ?? "",
                    menuUrl: editing.menuUrl ?? "",
                    desc: editing.desc ?? "",
                  }}
                  onSuccess={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete offer?"}
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        pending={pending}
      />
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: "pointer",
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 12,
        background: active ? "#1c2b46" : "#fff",
        color: active ? "#fff" : "#6c7a93",
        border: active ? "1.5px solid #1c2b46" : "1.5px solid #e7eaf0",
        fontWeight: active ? 800 : 700,
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  color,
  bg,
  onClick,
  children,
}: {
  color: string;
  bg: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      style={{
        cursor: "pointer",
        border: "none",
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        padding: "5px 11px",
        borderRadius: 8,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
