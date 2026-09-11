"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrinterIcon } from "lucide-react";
import { generateCardQr } from "./card-qr";
import { buildCardPrintPdf } from "./card-print";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BanIcon,
  Check,
  CheckCircle2Icon,
  ChevronDownIcon,
  MapPinnedIcon,
  ShieldAlertIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Formik, Form } from "formik";
import { FormSelectField } from "@/components/console-form-field";
import { CardStatusBadge } from "../_lib/valet-ui";
import type { CardTableItem } from "../_lib/valet-data";

function QrPrintDialog({
  open,
  onOpenChange,
  cardNumber,
  propertyName,
  canPrint,
  onPrinted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardNumber: string;
  propertyName?: string | null;
  canPrint: boolean;
  onPrinted: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const generatedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (generatedFor.current === cardNumber) return;
    let cancelled = false;
    generateCardQr(cardNumber)
      .then((uri) => {
        if (cancelled) return;
        setDataUrl(uri);
        generatedFor.current = cardNumber;
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cardNumber]);

  // #48 Step 3: exporting the card as a print sheet is a real print run — it
  // freezes the card's UID + property (mark printed) after generating the PDF.
  async function handleExportPdf() {
    setPdfBusy(true);
    try {
      const { blob, filename } = await buildCardPrintPdf({
        faces: [{ uid: cardNumber, property: propertyName ?? null, drawQr: true, drawUid: true }],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (canPrint) onPrinted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create the print sheet.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style>{`
@media print {
  body * { visibility: hidden !important; }
  .print-card-dialog, .print-card-dialog * { visibility: visible !important; }
  .print-card-dialog {
    position: absolute !important;
    inset: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  button { display: none !important; }
}
`}</style>
      <DialogContent
        className="sm:max-w-[360px] print-card-dialog"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="pr-8 text-[17px] font-extrabold text-[#1c2b46]">Card #{cardNumber}</div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
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

        <div
          className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-[#e7eaf0] bg-white p-5"
          style={{ minHeight: 260 }}
        >
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR code for card ${cardNumber}`} width={240} height={240} />
          ) : (
            <div className="text-[12.5px] font-semibold text-[#9aa6bc]">Generating…</div>
          )}
        </div>

        <div className="mt-2 text-center text-[12px] font-medium leading-relaxed text-[#6c7a93]">
          Guest scans this QR (or taps the card&apos;s NFC tag) to pull up the car. Prints a guest
          card bound to <span className="font-bold text-[#1c2b46]">#{cardNumber}</span>.
          {canPrint ? (
            <>
              {" "}
              Exporting a print sheet freezes the card&apos;s UID and property.
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-4 w-full rounded-full bg-[#1c2b46] py-3 text-[13px] font-extrabold text-white"
        >
          Print card
        </button>

        {canPrint ? (
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfBusy}
            className="mt-2 w-full rounded-full border border-[#1c2b46] bg-white py-3 text-[13px] font-extrabold text-[#1c2b46]"
          >
            {pdfBusy ? "Preparing PDF…" : "Download print sheet (PDF) · Freeze"}
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const REMOVABLE_STATUSES = ["unassigned", "assigned", "defect"];

function AssignToPropertyDialog({
  open,
  onOpenChange,
  uid,
  properties,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  properties: { id: number; name: string }[];
  organizationId?: string | null;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[420px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Assign card {uid}</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-[#6c7a93]">
              Bind the card to a branch property. The property freezes once the card is printed.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
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
          <Formik
          initialValues={{ propertyId: "" }}
          validate={(values) => {
            if (!values.propertyId) return { propertyId: "Pick a property." };
            return {};
          }}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const res = await fetch("/api/platform/valet/cards", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: 0,
                  uid,
                  action: "assign",
                  propertyId: Number(values.propertyId),
                  ...(organizationId ? { organizationId } : {}),
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Failed to assign card");
              toast.success(`Card ${uid} assigned.`);
              onOpenChange(false);
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Something went wrong.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FormSelectField
                name="propertyId"
                label="Property"
                options={[{ value: "", label: "Select…" }, ...properties.map((p) => ({ value: String(p.id), label: p.name }))]}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Assigning…" : "Assign card"}
              </button>
            </Form>
          )}
          </Formik>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CardTableRow({
  card,
  canPrint,
  properties,
  organizationId,
  selectable,
  selected,
  onToggleSelect,
}: {
  card: CardTableItem;
  canPrint: boolean;
  properties: { id: number; name: string }[];
  organizationId?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (uid: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const isBlocked = card.status === "blocked";
  const isWithGuest = card.status === "with_guest";
  const isReturned = card.status === "returned";
  const isDeckCard = card.status === "unassigned" || card.status === "assigned";
  const removable = REMOVABLE_STATUSES.includes(card.status);

  // #48 org-scope: the Super Admin's per-org tab scopes assign/unassign/ops to
  // the org it views, but unassigned (deck) cards are platform inventory — only
  // remove them org-scoped when they are property-bound.
  const orgScope = organizationId && card.propertyId ? organizationId : undefined;

  function runAction(action: "block" | "unblock" | "mark-returned" | "lost", successMsg: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: card.id,
            action,
            ...(orgScope ? { organizationId: orgScope } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update card");
        toast.success(successMsg);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function runUidAction(action: "unassign" | "printed" | "defect", successMsg: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: card.id,
            uid: card.uid,
            action,
            ...(orgScope ? { organizationId: orgScope } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update card");
        toast.success(successMsg);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: card.id,
            remove: true,
            ...(organizationId ? { organizationId } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to remove card");
        toast.success("Card removed.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setRemoveOpen(false);
      }
    });
  }

  return (
    <TableRow>
      {selectable ? (
        <TableCell className="w-10 pr-0">
          <label className="checkbox" aria-label={`Select ${card.uid}`} style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              className="checkbox-input"
              checked={!!selected}
              onChange={() => onToggleSelect?.(card.uid)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={`checkbox-box${selected ? " checked" : ""}`}>
              <Check size={12} strokeWidth={3.5} color="#ffffff" />
            </span>
          </label>
        </TableCell>
      ) : null}
      <TableCell className="text-[13px] font-extrabold text-[#1c2b46]">{card.uid}</TableCell>
      <TableCell>
        <CardStatusBadge status={card.statusLabel} tone={card.statusTone} />
      </TableCell>
      <TableCell className="text-[13px] font-bold text-[#6c7a93]">{card.property ?? "Unassigned"}</TableCell>
      <TableCell className="text-[13px] font-semibold text-[#9aa6bc]">{card.by}</TableCell>
      <TableCell className="text-[13px] font-extrabold text-[#1c2b46]">{card.uses}</TableCell>
      <TableCell className={`text-[13px] font-semibold ${card.orderMuted ? "text-[#9aa6bc]" : "text-[#6c7a93]"}`}>
        {card.order}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Manage ${card.uid}`}
                disabled={pending}
                style={{
                  cursor: "pointer",
                  border: "1px solid #e7eaf0",
                  background: "#fff",
                  color: "#1c2b46",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "7px 11px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                Manage
                <ChevronDownIcon className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" style={{ minWidth: 220, borderRadius: 14, padding: 6 }}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-[#9aa6bc]">
                {card.uid}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setQrOpen(true)} disabled={pending}>
              <PrinterIcon className="size-4" /> Print card / QR
            </DropdownMenuItem>
            {isDeckCard ? (
              <DropdownMenuItem onClick={() => setAssignOpen(true)} disabled={pending}>
                <TagIcon className="size-4" /> Assign to property
              </DropdownMenuItem>
            ) : null}
            {card.status === "assigned" ? (
              <DropdownMenuItem onClick={() => runUidAction("unassign", "Card unassigned.")} disabled={pending}>
                <MapPinnedIcon className="size-4" /> Unassign from property
              </DropdownMenuItem>
            ) : null}
            {canPrint && card.status !== "defect" ? (
              <>
                <DropdownMenuItem onClick={() => runUidAction("printed", "Card marked printed (frozen).")} disabled={pending}>
                  <CheckCircle2Icon className="size-4" /> Mark printed / freeze
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runUidAction("defect", "Card marked defect.")} disabled={pending}>
                  <ShieldAlertIcon className="size-4" /> Mark defect
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            {isWithGuest ? null : (
              <DropdownMenuItem onClick={() => runAction("block", "Card blocked.")} disabled={pending}>
                <BanIcon className="size-4" /> Block card
              </DropdownMenuItem>
            )}
            {isBlocked ? (
              <DropdownMenuItem onClick={() => runAction("unblock", "Card unblocked.")} disabled={pending}>
                <CheckCircle2Icon className="size-4" /> Unblock card
              </DropdownMenuItem>
            ) : null}
            {isReturned ? (
              <DropdownMenuItem onClick={() => runAction("mark-returned", "Card marked returned.")} disabled={pending}>
                <CheckCircle2Icon className="size-4" /> Mark returned
              </DropdownMenuItem>
            ) : null}
            {!isBlocked ? (
              <DropdownMenuItem onClick={() => runAction("lost", "Card marked lost.")} disabled={pending}>
                <MapPinnedIcon className="size-4" /> Mark lost
              </DropdownMenuItem>
            ) : null}
            {removable ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRemoveOpen(true)} className="text-[#e23d3d] focus:text-[#e23d3d]">
                  <Trash2Icon className="size-4" /> Remove
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove card "${card.uid}"?`}
        message="This permanently removes the card from the deck. Printed and operational cards cannot be removed."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        pending={pending}
      />

      <AssignToPropertyDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        uid={card.uid}
        properties={properties}
        organizationId={orgScope}
      />

      <QrPrintDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        cardNumber={card.uid}
        propertyName={card.property}
        canPrint={canPrint}
        onPrinted={() => runUidAction("printed", "Card marked printed (frozen).")}
      />
    </TableRow>
  );
}