"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// #32 tenant-admin surface: dialog to record/replace the vehicle-condition
// record (pre-existing damage / mileage / notes) against a queue order.
// Driver-app / guest-web capture flows land later.

const DAMAGE_OPTIONS = [
  { key: "scratches", label: "Scratches" },
  { key: "dents", label: "Dents" },
  { key: "glass", label: "Glass" },
  { key: "lights", label: "Lights" },
  { key: "mirrors", label: "Mirrors" },
  { key: "wheels", label: "Wheels / tyres" },
  { key: "other", label: "Other" },
];

export interface OrderCondition {
  damage: string[];
  mileageKm: number | null;
  notes: string | null;
}

export function OrderConditionDialog({
  orderId,
  plate,
  car,
  initial,
  onSaved,
  onClose,
}: {
  orderId: number;
  plate: string;
  car: string;
  initial: OrderCondition | null;
  onSaved: (condition: OrderCondition) => void;
  onClose: () => void;
}) {
  const [damage, setDamage] = useState<string[]>(initial?.damage ?? []);
  const [mileage, setMileage] = useState<string>(
    initial?.mileageKm != null ? String(initial.mileageKm) : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();

  function toggle(key: string) {
    setDamage((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function save() {
    const mileageNum = mileage.trim() === "" ? null : Number(mileage);
    if (mileageNum !== null && (!Number.isFinite(mileageNum) || mileageNum < 0 || mileageNum > 1_000_000)) {
      toast.error("Mileage must be a whole number of km between 0 and 1,000,000.");
      return;
    }
    const body = {
      damage,
      mileageKm: mileageNum,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      const res = await fetch(`/api/platform/valet/orders/${orderId}/condition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.error ?? "Failed to save the condition.");
        return;
      }
      toast.success("Vehicle condition recorded.");
      onSaved({ damage, mileageKm: mileageNum, notes: notes.trim() || null });
      onClose();
    });
  }

  const hasRecord =
    (initial?.damage?.length ?? 0) > 0 ||
    initial?.mileageKm != null ||
    (initial?.notes ?? "").trim() !== "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
        aria-describedby={undefined}
      >
        <div className="pr-8">
          <div className="text-[17px] font-extrabold text-[#1c2b46]">Vehicle condition</div>
          <div className="mt-0.5 text-[12.5px] font-medium text-[#6c7a93]">
            Pre-existing damage at pickup · #{orderId} {plate}
            {car ? ` · ${car}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[10px] top-[10px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#f6f7f9] text-[#6c7a93] transition hover:bg-[#e9edf2]"
        >
          <XIcon size={16} />
        </button>

        <div className="mb-3">
          <div className="mb-2 text-[12px] font-extrabold text-[#1c2b46]">Damage</div>
          <div className="flex flex-wrap gap-1.5">
            {DAMAGE_OPTIONS.map((d) => {
              const on = damage.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d.key)}
                  className={`rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-bold transition ${
                    on
                      ? "border-[#f4531f] bg-[#f4531f]/10 text-[#f4531f]"
                      : "border-[#e7eaf0] bg-white text-[#6c7a93] hover:border-[#cdd5e0]"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="cond-mileage" className="text-[12px] font-extrabold text-[#1c2b46]">
            Mileage (km)
          </label>
          <input
            id="cond-mileage"
            type="number"
            min={0}
            max={1_000_000}
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 12400"
            className="mt-1 w-full rounded-xl border-[1.5px] border-[#e7eaf0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1c2b46] outline-none placeholder:font-medium placeholder:text-[#b3bcc9] focus:border-[#f4531f]"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="cond-notes" className="text-[12px] font-extrabold text-[#1c2b46]">
            Notes
          </label>
          <textarea
            id="cond-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Visible damage, unusual marks, existing repairs…"
            className="mt-1 w-full resize-none rounded-xl border-[1.5px] border-[#e7eaf0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1c2b46] outline-none placeholder:font-medium placeholder:text-[#b3bcc9] focus:border-[#f4531f]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-full bg-[#f6f7f9] px-5 text-[13px] font-bold text-[#1c2b46] transition hover:bg-[#e9edf2]"
          >
            {hasRecord ? "Discard" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-10 rounded-full bg-[#f4531f] px-5 text-[13px] font-bold text-white transition hover:bg-[#e04314] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save condition"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}