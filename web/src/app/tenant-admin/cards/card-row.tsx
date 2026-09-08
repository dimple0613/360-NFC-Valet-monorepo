"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PrinterIcon } from "lucide-react";
import { generateCardQr } from "./card-qr";
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
  CheckCircle2Icon,
  ChevronDownIcon,
  MapPinnedIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CardStatusBadge } from "../_lib/valet-ui";
import type { CardTableItem } from "../_lib/valet-data";

function QrPrintDialog({
  open,
  onOpenChange,
  cardNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardNumber: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
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
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-4 w-full rounded-full bg-[#1c2b46] py-3 text-[13px] font-extrabold text-white"
        >
          Print card
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function CardTableRow({ card }: { card: CardTableItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [newUid, setNewUid] = useState(card.uid);
  const [savingUid, setSavingUid] = useState(false);

  const isBlocked = card.status === "blocked";
  const isWithGuest = card.status === "with_guest";
  const isReturned = card.status === "returned";

  function runAction(action: "block" | "unblock" | "mark-returned" | "lost", successMsg: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, action }),
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

  function submitEditUid() {
    const value = newUid.trim().toUpperCase();
    if (!value) return;
    setSavingUid(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, action: "updateUid", uid: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update UID");
        toast.success("Card UID updated.");
        setEditOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setSavingUid(false);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, remove: true }),
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
      <TableCell className="text-[12.5px] font-extrabold text-[#1c2b46]">{card.uid}</TableCell>
      <TableCell>
        <CardStatusBadge status={card.statusLabel} tone={card.statusTone} />
      </TableCell>
      <TableCell className="text-[12.5px] font-bold text-[#6c7a93]">{card.property}</TableCell>
      <TableCell className="text-[12px] font-semibold text-[#9aa6bc]">{card.by}</TableCell>
      <TableCell className="text-[12.5px] font-extrabold text-[#1c2b46]">{card.uses}</TableCell>
      <TableCell className={`text-[12px] font-semibold ${card.orderMuted ? "text-[#9aa6bc]" : "text-[#6c7a93]"}`}>
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
          <DropdownMenuContent align="end" style={{ minWidth: 210, borderRadius: 14, padding: 6 }}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-[#9aa6bc]">
                {card.uid}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" /> Edit UID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setQrOpen(true)} disabled={pending}>
              <PrinterIcon className="size-4" /> Print card / QR
            </DropdownMenuItem>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setRemoveOpen(true)} className="text-[#e23d3d] focus:text-[#e23d3d]">
              <Trash2Icon className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-[420px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="pr-8 text-[17px] font-extrabold text-[#1c2b46]">Edit card UID</div>
          <div className="mt-1 pr-8 text-[12.5px] font-medium text-[#6c7a93]">Change the UID for card {card.uid}.</div>
          <button
            type="button"
            onClick={() => setEditOpen(false)}
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
          <input
            value={newUid}
            onChange={(e) => setNewUid(e.target.value.toUpperCase())}
            placeholder="A–Z, 0–9 and dashes (max 24)"
            className="mt-4 w-full rounded-xl border-[1.5px] border-[#e7eaf0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1c2b46] uppercase outline-none focus:border-[#f4531f]"
          />
          <button
            type="button"
            onClick={submitEditUid}
            disabled={savingUid || !newUid.trim()}
            className="mt-4 w-full rounded-full bg-[#f4531f] py-3 text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {savingUid ? "Saving…" : "Save UID"}
          </button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove card "${card.uid}"?`}
        message="This will permanently remove the card from the property pool."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        pending={pending}
      />

      <QrPrintDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        cardNumber={card.uid}
      />
    </TableRow>
  );
}
