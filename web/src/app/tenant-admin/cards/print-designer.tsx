"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, EyeIcon, PrinterIcon, UploadIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildCardPrintPdf,
  PRINT_CARD_W_MM,
  PRINT_CARD_H_MM,
  type QrPlacement,
  type UidPlacement,
} from "./card-print";
import { generateCardQr } from "./card-qr";

type PrintProfile = {
  id: number;
  name: string;
  frontImageUrl: string | null;
  backImageUrl: string | null;
};

type SelectedCard = { uid: string; property?: string | null };

const QR_PRESETS: { value: QrPlacement["preset"]; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "center", label: "Center" },
];

const UID_PRESETS: { value: UidPlacement["preset"]; label: string }[] = [
  { value: "top-center", label: "Top center" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "center", label: "Center" },
];

const SIDES = [
  { value: "front", label: "Front only" },
  { value: "back", label: "Back only" },
  { value: "both", label: "Front + back" },
] as const;

type SideMode = (typeof SIDES)[number]["value"];

const STEPS = [
  { title: "Design", blurb: "Choose the card artwork" },
  { title: "Arrange", blurb: "Place the QR code & number" },
  { title: "Export", blurb: "Download the batch" },
] as const;

// QR and UID can each live on the front OR the back of the card — e.g. the
// card number on the back and the QR on the front.
function SidePicker({
  value,
  onChange,
}: {
  value: "front" | "back";
  onChange: (side: "front" | "back") => void;
}) {
  return (
    <div className="flex gap-2">
      {(["front", "back"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={`flex-1 rounded-full px-3 py-2 text-[12px] font-bold ${
            value === s
              ? "bg-[#1c2b46] text-white"
              : "border border-[#e7eaf0] bg-white text-[#6c7a93]"
          }`}
        >
          {s === "front" ? "Front" : "Back"}
        </button>
      ))}
    </div>
  );
}

/** Same validation as the Locations page upload: FileReader → base64 data URL, 5 MB cap. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (file.size > 5 * 1024 * 1024) return reject(new Error("File must be under 5 MB"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const UPLOAD_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 20,
  height: 20,
  padding: 0,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#6c7a93",
};

const REMOVE_STYLE: React.CSSProperties = {
  marginTop: 6,
  border: "1px solid #e7eaf0",
  background: "#fff",
  color: "#d6430f",
  fontSize: 11,
  fontWeight: 800,
  padding: "6px 12px",
  borderRadius: 999,
  cursor: "pointer",
};

// Console profile dialog upload, mirroring the Locations page: pick a file from
// disk (JPG/PNG), stored as a data URL, with a preview toggle + remove button —
// not a paste-a-URL field.
function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const fileId = useId();
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasImage = Boolean(value);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      if (e.target) e.target.value = "";
      setPreviewOpen(false);
    }
  };

  return (
    <div>
      <div className="field">
        <label className="field-label">{label}</label>
        <label
          htmlFor={hasImage ? undefined : fileId}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: hasImage ? "default" : "pointer",
          }}
        >
          <input
            className="field-value input"
            readOnly
            placeholder="Upload image (JPG/PNG)"
            value={hasImage ? "Image attached" : ""}
            style={{
              flex: 1,
              minWidth: 0,
              paddingRight: 40,
              cursor: hasImage ? "default" : "pointer",
              pointerEvents: "none",
            }}
          />
          {hasImage ? (
            <button
              type="button"
              aria-label={previewOpen ? "Hide preview" : "Show preview"}
              onClick={() => setPreviewOpen((o) => !o)}
              style={UPLOAD_STYLE}
            >
              <EyeIcon size={16} strokeWidth={2} />
            </button>
          ) : (
            <span style={UPLOAD_STYLE} aria-hidden="true">
              <UploadIcon size={16} strokeWidth={2} />
            </span>
          )}
        </label>
      </div>
      {previewOpen && hasImage ? (
        <>
          <div
            style={{
              marginTop: 8,
              border: "1.5px dashed #C3CAD6",
              borderRadius: 12,
              padding: 8,
              background: "none",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-label={`${label} preview`}
              style={{
                width: "100%",
                height: 110,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundImage: `url("${value}")`,
                borderRadius: 10,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setPreviewOpen(false);
            }}
            style={REMOVE_STYLE}
          >
            Remove
          </button>
        </>
      ) : null}
      <input
        id={fileId}
        type="file"
        accept="image/*"
        onChange={handleFile}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <Select
        name={label}
        value={value}
        onValueChange={(v) => onChange(v ?? "")}
        items={options.map((o) => ({ value: o.value, label: o.label }))}
      >
        <SelectTrigger className="w-full bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="field-value input"
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}

function FieldColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 40,
            height: 36,
            padding: 0,
            border: "1px solid #e7eaf0",
            borderRadius: 8,
            background: "#fff",
            cursor: "pointer",
          }}
        />
        <input
          className="field-value input"
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v.startsWith("#") ? v : `#${v}`.slice(0, 7));
          }}
          placeholder="#1c2b46"
        />
      </div>
    </div>
  );
}

function SiteCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="checkbox" style={{ cursor: "pointer" }}>
      <input type="checkbox" className="checkbox-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`checkbox-box${checked ? " checked" : ""}`}>
        <Check size={12} strokeWidth={3.5} color="#ffffff" />
      </span>
      <span className="checkbox-label">{label}</span>
    </label>
  );
}

function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

const SCALE = 3.2;

function PreviewCard({
  profile,
  card,
  qrPlacement,
  uidPlacement,
  side,
  qrSide,
  uidSide,
  showElements = true,
}: {
  profile: PrintProfile | null;
  card: SelectedCard;
  qrPlacement: QrPlacement;
  uidPlacement: UidPlacement;
  side: "front" | "back";
  qrSide: "front" | "back";
  uidSide: "front" | "back";
  showElements?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (qrSide !== side) return;
    let cancelled = false;
    generateCardQr(card.uid)
      .then((u) => {
        if (!cancelled) setQr(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [card.uid, side, qrSide]);

  const w = Math.round(PRINT_CARD_W_MM * SCALE);
  const h = Math.round(PRINT_CARD_H_MM * SCALE);
  const imageUrl = side === "front" ? profile?.frontImageUrl : profile?.backImageUrl;
  const image = imageUrl ? `url("${imageUrl}")` : undefined;

  const qrSize = Math.round((qrPlacement.sizeMm ?? 26) * SCALE);
  const pad = Math.round(3 * SCALE);

  const qrRect = useMemo(() => {
    if (qrPlacement.xMm != null && qrPlacement.yMm != null) {
      return { x: Math.round(qrPlacement.xMm * SCALE), y: Math.round(qrPlacement.yMm * SCALE) };
    }
    const P = {
      "top-left": { x: pad, y: pad },
      "top-right": { x: w - pad - qrSize, y: pad },
      "bottom-left": { x: pad, y: h - pad - qrSize },
      "bottom-right": { x: w - pad - qrSize, y: h - pad - qrSize },
      center: { x: (w - qrSize) / 2, y: (h - qrSize) / 2 },
    } as const;
    return P[qrPlacement.preset];
  }, [qrPlacement, w, h, qrSize, pad]);

  const uidStyle = useMemo(() => {
    const size = uidPlacement.size ?? 12;
    const fontSize = Math.max(8, Math.round((size * SCALE) / 2.835));
    const padBottom = Math.round(Math.max(6, size * 0.45 + 3) * SCALE);
    const padX = Math.round(4 * SCALE);
    const topLine = Math.round((size * SCALE) / 2.835 + 2 * SCALE);
    const base: React.CSSProperties = {
      position: "absolute",
      fontSize,
      fontWeight: 800,
      color: uidPlacement.color ?? "#1c2b46",
      whiteSpace: "nowrap",
    };
    if (uidPlacement.xMm != null && uidPlacement.yMm != null) {
      return { ...base, left: Math.round(uidPlacement.xMm * SCALE), top: Math.round(uidPlacement.yMm * SCALE) };
    }
    switch (uidPlacement.preset) {
      case "top-left":
        return { ...base, left: padX, top: topLine };
      case "top-right":
        return { ...base, right: padX, top: topLine };
      case "bottom-left":
        return { ...base, left: padX, bottom: padBottom };
      case "bottom-right":
        return { ...base, right: padX, bottom: padBottom };
      case "bottom-center":
        return { ...base, left: "50%", transform: "translateX(-50%)", bottom: padBottom };
      case "center":
        return { ...base, left: "50%", transform: "translateX(-50%)", top: (h - fontSize) / 2 };
      case "top-center":
      default:
        return { ...base, left: "50%", transform: "translateX(-50%)", top: topLine };
    }
  }, [uidPlacement, h]);

  const showQr = showElements && qrSide === side;
  const showUid = showElements && uidSide === side;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[#e7eaf0]"
      style={{
        width: w,
        height: h,
        background: image ? `${image} center / cover no-repeat` : "#fafbfc",
      }}
    >
      {showQr ? (
        <div
          className="absolute flex items-center justify-center"
          style={{ left: qrRect.x, top: qrRect.y, width: qrSize, height: qrSize }}
        >
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="" className="h-full w-full" />
          ) : (
            <div className="text-[8px] font-semibold text-[#9aa6bc]">QR</div>
          )}
        </div>
      ) : null}
      {showUid ? <div style={uidStyle}>{card.uid}</div> : null}
      {side === "back" && !showQr && !showUid ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#9aa6bc]">
          Back
        </div>
      ) : null}
    </div>
  );
}

export function PrintDesignerDialog({
  open,
  onOpenChange,
  cards,
  canFreeze,
  onFrozen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: SelectedCard[];
  canFreeze: boolean;
  onFrozen: (frozenUids: string[]) => void;
}) {
  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [profileId, setProfileId] = useState<number | "">("");
  const [side, setSide] = useState<SideMode>("front");
  const [qrSide, setQrSide] = useState<"front" | "back">("front");
  const [uidSide, setUidSide] = useState<"front" | "back">("front");

  const [qrPreset, setQrPreset] = useState<QrPlacement["preset"]>("bottom-right");
  const [qrSizeMm, setQrSizeMm] = useState(26);
  const [useQrFree, setUseQrFree] = useState(false);
  const [qrFreeX, setQrFreeX] = useState<number | null>(null);
  const [qrFreeY, setQrFreeY] = useState<number | null>(null);

  const [uidPreset, setUidPreset] = useState<UidPlacement["preset"]>("top-center");
  const [uidSize, setUidSize] = useState(12);
  const [uidColor, setUidColor] = useState("#1c2b46");
  const [useUidFree, setUseUidFree] = useState(false);
  const [uidFreeX, setUidFreeX] = useState<number | null>(null);
  const [uidFreeY, setUidFreeY] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{ id?: number; name: string; front: string; back: string }>({
    name: "",
    front: "",
    back: "",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/platform/valet/print-profiles")
      .then((res) => (res.ok ? res.json() : Promise.resolve({ profiles: [] })))
      .then((data) => {
        setProfiles(data.profiles ?? []);
        setProfileId("");
        setStep(0);
      })
      .catch(() => {
        setProfiles([]);
        setProfileId("");
        setStep(0);
      });
  }, [open]);

  const profile = profiles.find((p) => p.id === profileId) ?? null;

  function goNext() {
    if (step === 0 && !profile) {
      toast.error("Pick or create a design first — it supplies the artwork for the batch.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const qrPlacement: QrPlacement = useMemo(
    () => ({
      preset: qrPreset,
      sizeMm: qrSizeMm,
      ...(useQrFree && qrFreeX != null && qrFreeY != null ? { xMm: qrFreeX, yMm: qrFreeY } : {}),
    }),
    [qrPreset, qrSizeMm, useQrFree, qrFreeX, qrFreeY],
  );

  const uidPlacement: UidPlacement = useMemo(
    () => ({
      preset: uidPreset,
      size: uidSize,
      color: uidColor,
      ...(useUidFree && uidFreeX != null && uidFreeY != null ? { xMm: uidFreeX, yMm: uidFreeY } : {}),
    }),
    [uidPreset, uidSize, uidColor, useUidFree, uidFreeX, uidFreeY],
  );

  async function generatePdf() {
    if (!profile) {
      toast.error("Pick a print profile first.");
      return;
    }
    if (!cards.length) return;
    setBusy(true);
    try {
      const faces: {
        uid: string;
        property?: string | null;
        imageUrl?: string | null;
        drawQr?: boolean;
        drawUid?: boolean;
      }[] = [];
      for (const c of cards) {
        if (side === "front" || side === "both") {
          faces.push({
            uid: c.uid,
            property: c.property,
            imageUrl: profile.frontImageUrl,
            drawQr: qrSide === "front",
            drawUid: uidSide === "front",
          });
        }
        if (side === "back" || side === "both") {
          faces.push({
            uid: c.uid,
            property: c.property,
            imageUrl: profile.backImageUrl,
            drawQr: qrSide === "back",
            drawUid: uidSide === "back",
          });
        }
      }
      const { blob, filename } = await buildCardPrintPdf({
        faces,
        placement: qrPlacement,
        uidPlacement,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (canFreeze) {
        await Promise.all(
          cards.map((c) =>
            fetch("/api/platform/valet/cards", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid: c.uid, action: "printed" }),
            }),
          ),
        );
        onFrozen(cards.map((c) => c.uid));
      }
      toast.success(`Exported ${faces.length} card face(s) to PDF.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to build the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!editDraft.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const url = "/api/platform/valet/print-profiles";
      const res = editDraft.id
        ? await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editDraft.id,
              name: editDraft.name,
              frontImageUrl: editDraft.front || null,
              backImageUrl: editDraft.back || null,
            }),
          })
        : await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: editDraft.name,
              frontImageUrl: editDraft.front || null,
              backImageUrl: editDraft.back || null,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }
      const data = await res.json().catch(() => ({}));
      const savedId = editDraft.id ?? Number(data?.id);
      toast.success(editDraft.id ? "Profile updated." : "Profile created.");
      const next = await fetch("/api/platform/valet/print-profiles").then((r) =>
        r.ok ? r.json() : Promise.resolve({ profiles: [] }),
      );
      setProfiles(next.profiles ?? []);
      if (savedId) setProfileId(savedId);
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    if (!profileId || !profile) return;
    if (!window.confirm(`Delete print profile "${profile.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/valet/print-profiles?id=${profileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete profile");
      toast.success("Profile deleted.");
      setProfileId("");
      const next = await fetch("/api/platform/valet/print-profiles").then((r) =>
        r.ok ? r.json() : Promise.resolve({ profiles: [] }),
      );
      setProfiles(next.profiles ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[920px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24, maxHeight: "92vh", overflowY: "auto" }}
        >
          <DialogCloseButton onClick={() => onOpenChange(false)} />

          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">Batch print designer</div>
              <div className="mt-0.5 text-[12.5px] font-medium text-[#6c7a93]">
                Print{cards.length > 1 ? `s ${cards.length} cards` : "s 1 card"} in one PDF — your artwork, a
                scannable QR code and the card number.
                {canFreeze ? " Cards are marked as printed once downloaded." : ""}
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {STEPS.map((s, i) => (
              <Fragment key={s.title}>
                {i > 0 ? <div className="h-px min-w-1 flex-1 bg-[#e7eaf0]" /> : null}
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-[#f6f7f9]"
                  aria-current={step === i ? "step" : undefined}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
                      i <= step ? "bg-[#f4531f] text-white" : "bg-[#f1f3f6] text-[#9aa6bc]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-left leading-tight">
                    <span
                      className={`block text-[11.5px] font-extrabold ${
                        i <= step ? "text-[#1c2b46]" : "text-[#9aa6bc]"
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="block text-[10.5px] font-medium text-[#9aa6bc]">{s.blurb}</span>
                  </span>
                </button>
              </Fragment>
            ))}
          </div>

          <div className="super-console mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Left: controls */}
            <div className="flex flex-col gap-4">
              {step === 0 ? (
                <>
                  {/* Sides */}
                  <div className="rounded-2xl border border-[#e7eaf0] p-4">
                    <div className="text-[12.5px] font-extrabold text-[#1c2b46]">
                      Which sides get artwork?
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#6c7a93]">
                      Pick the side(s) of the card that will be printed.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SIDES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          aria-pressed={side === s.value}
                          onClick={() => setSide(s.value)}
                          className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
                            side === s.value
                              ? "bg-[#f4531f] text-white"
                              : "border border-[#e7eaf0] bg-white text-[#6c7a93]"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Profile picker + manage */}
                  <div className="rounded-2xl border border-[#e7eaf0] p-4">
                    <div className="text-[12.5px] font-extrabold text-[#1c2b46]">Pick the design</div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#6c7a93]">
                      Designs hold your artwork. Create one now, then reuse it on the next batch.
                    </div>
                    <div className="mt-3">
                      {profiles.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#c3cad6] p-4 text-center">
                          <div className="text-[12.5px] font-bold text-[#1c2b46]">No designs yet</div>
                          <div className="mt-1 text-[12px] font-medium text-[#6c7a93]">
                            Add the artwork your cards will be printed on.
                          </div>
                          <button
                            type="button"
                            className="btn-primary mt-3 px-4 py-2 text-[12px]"
                            onClick={() => {
                              setEditDraft({ name: "", front: "", back: "" });
                              setEditOpen(true);
                            }}
                          >
                            + Create design
                          </button>
                        </div>
                      ) : (
                        <div className="field">
                          <label className="field-label">
                            Saved design{profile ? " · " + profile.name : ""}
                          </label>
                          <Select
                            name="profileId"
                            value={profileId === "" ? "" : String(profileId)}
                            onValueChange={(v) => setProfileId(v ? Number(v) : "")}
                            items={[
                              { value: "", label: "Select a design…" },
                              ...profiles.map((p) => ({ value: String(p.id), label: p.name })),
                            ]}
                          >
                            <SelectTrigger className="w-full bg-transparent">
                              <SelectValue placeholder="Select a design…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Select a design…</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {profiles.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditDraft({ name: "", front: "", back: "" });
                            setEditOpen(true);
                          }}
                          className="rounded-full border border-[#f4531f] bg-white px-3 py-1.5 text-[12px] font-bold text-[#f4531f]"
                        >
                          + New
                        </button>
                        {profile ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditDraft({
                                id: profile.id,
                                name: profile.name,
                                front: profile.frontImageUrl ?? "",
                                back: profile.backImageUrl ?? "",
                              });
                              setEditOpen(true);
                            }}
                            className="rounded-full border border-[#1c2b46] bg-white px-3 py-1.5 text-[12px] font-bold text-[#1c2b46]"
                          >
                            Edit
                          </button>
                        ) : null}
                        {profile ? (
                          <button
                            type="button"
                            onClick={removeProfile}
                            disabled={busy}
                            className="rounded-full border border-[#e23d3d] bg-white px-3 py-1.5 text-[12px] font-bold text-[#e23d3d] disabled:opacity-50"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  {/* QR placement */}
                  <div className="rounded-2xl border border-[#e7eaf0] p-4">
                    <div className="text-[12.5px] font-extrabold text-[#1c2b46]">QR code</div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#6c7a93]">
                      Guests scan this on the {qrSide === "front" ? "front" : "back"} of the card.
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#6c7a93]">
                        Which side?
                      </div>
                      <SidePicker value={qrSide} onChange={setQrSide} />
                      {side !== "both" && side !== qrSide ? (
                        <div className="mt-1.5 text-[11.5px] font-bold text-[#d6430f]">
                          Batch prints {SIDES.find((s) => s.value === side)?.label} — the QR won&apos;t be included.
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <FieldSelect
                        label="Position"
                        value={qrPreset}
                        onChange={(v) => setQrPreset(v as QrPlacement["preset"])}
                        options={QR_PRESETS}
                      />
                    </div>
                    <div className="mt-3">
                      <FieldNumber label="Size (mm)" min={10} max={50} value={qrSizeMm} onChange={setQrSizeMm} />
                      <div className="mt-1 text-[11.5px] font-medium text-[#9aa6bc]">
                        26 mm is roughly the size of a coin.
                      </div>
                    </div>
                    <div className="mt-3">
                      <SiteCheckbox
                        checked={useQrFree}
                        onChange={setUseQrFree}
                        label="Fine-tune position (advanced)"
                      />
                      {useQrFree ? (
                        <>
                          <div className="mt-1 text-[11.5px] font-medium text-[#9aa6bc]">
                            Set the exact spot in millimetres, measured from the top-left corner.
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <FieldNumber label="X (mm)" value={qrFreeX ?? 0} onChange={setQrFreeX} />
                            <FieldNumber label="Y (mm)" value={qrFreeY ?? 0} onChange={setQrFreeY} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* UID placement — independent of the QR */}
                  <div className="rounded-2xl border border-[#e7eaf0] p-4">
                    <div className="text-[12.5px] font-extrabold text-[#1c2b46]">Card number</div>
                    <div className="mt-0.5 text-[12px] font-medium text-[#6c7a93]">
                      Printed in bold on the {uidSide === "front" ? "front" : "back"} so staff can read it at a glance.
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#6c7a93]">
                        Which side?
                      </div>
                      <SidePicker value={uidSide} onChange={setUidSide} />
                      {side !== "both" && side !== uidSide ? (
                        <div className="mt-1.5 text-[11.5px] font-bold text-[#d6430f]">
                          Batch prints {SIDES.find((s) => s.value === side)?.label} — the number won&apos;t be included.
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <FieldSelect
                        label="Position"
                        value={uidPreset}
                        onChange={(v) => setUidPreset(v as UidPlacement["preset"])}
                        options={UID_PRESETS}
                      />
                    </div>
                    <div className="mt-3">
                      <FieldNumber label="Size (pt)" min={6} max={24} value={uidSize} onChange={setUidSize} />
                      <div className="mt-1 text-[11.5px] font-medium text-[#9aa6bc]">
                        12 pt is a normal print size.
                      </div>
                    </div>
                    <div className="mt-3">
                      <FieldColor label="Color" value={uidColor} onChange={setUidColor} />
                      <div className="mt-1 text-[11.5px] font-medium text-[#9aa6bc]">
                        Card number print color (hex code).
                      </div>
                    </div>
                    <div className="mt-3">
                      <SiteCheckbox
                        checked={useUidFree}
                        onChange={setUseUidFree}
                        label="Fine-tune position (advanced)"
                      />
                      {useUidFree ? (
                        <>
                          <div className="mt-1 text-[11.5px] font-medium text-[#9aa6bc]">
                            Set the exact spot in millimetres, measured from the top-left corner.
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <FieldNumber label="X (mm)" value={uidFreeX ?? 0} onChange={setUidFreeX} />
                            <FieldNumber label="Y (mm)" value={uidFreeY ?? 0} onChange={setUidFreeY} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <div className="rounded-2xl border border-[#e7eaf0] p-4">
                  <div className="text-[12.5px] font-extrabold text-[#1c2b46]">Your batch at a glance</div>
                  <dl className="mt-2 divide-y divide-[#f1f3f6]">
                    {(
                      [
                        ["Cards", `${cards.length}`],
                        ["Design", profile?.name ?? "—"],
                        ["Sides", SIDES.find((s) => s.value === side)?.label ?? "—"],
                        ["QR code", `${QR_PRESETS.find((p) => p.value === qrPreset)?.label ?? "—"} · ${qrSide === "front" ? "Front" : "Back"}`],
                        ["Card number", `${UID_PRESETS.find((p) => p.value === uidPreset)?.label ?? "—"} · ${uidSide === "front" ? "Front" : "Back"} · ${uidColor}`],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-2.5 text-[13px]">
                        <dt className="font-medium text-[#6c7a93]">{k}</dt>
                        <dd className="font-bold text-[#1c2b46]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>

            {/* Right: live preview or download */}
            <div className="flex flex-col gap-4">
              {step < 2 ? (
                <div className="rounded-2xl border border-[#e7eaf0] p-4">
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[1.2px] text-[#6c7a93]">
                    Live preview{step === 0 ? " · artwork" : " · QR & number"}
                  </div>
                  <div className="mb-2 text-[12px] font-medium text-[#6c7a93]">
                    {step === 0
                      ? "This is how the card will look."
                      : "Move the QR code and number — the preview updates instantly."}
                  </div>
                  <div className="flex max-h-[360px] flex-wrap items-center justify-center gap-3 overflow-auto p-2">
                    {cards.slice(0, 12).map((c) => {
                      const faces: ("front" | "back")[] =
                        side === "back" ? ["back"] : side === "both" ? ["front", "back"] : ["front"];
                      return (
                        <div key={c.uid} className="flex flex-col items-center gap-1.5">
                          {faces.map((f) => (
                            <PreviewCard
                              key={c.uid + f + qrSide + uidSide}
                              profile={profile}
                              card={c}
                              qrPlacement={qrPlacement}
                              uidPlacement={uidPlacement}
                              side={f}
                              qrSide={qrSide}
                              uidSide={uidSide}
                              showElements={step === 1}
                            />
                          ))}
                          {side === "both" ? (
                            <div className="text-[10px] font-semibold text-[#9aa6bc]">Front · Back</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e7eaf0] p-4">
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[1.2px] text-[#6c7a93]">
                    Download
                  </div>
                  <p className="text-[12.5px] font-medium text-[#6c7a93]">
                    Click below to download the PDF for all {cards.length} card{cards.length === 1 ? "" : "s"}.
                    {canFreeze
                      ? " They will be marked as printed so the batch is never printed twice."
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={generatePdf}
                    disabled={busy || !profile || !cards.length}
                    className="btn-primary mt-4 w-full"
                  >
                    {busy ? (
                      "Building PDF…"
                    ) : (
                      <>
                        <PrinterIcon className="size-4" />
                        Download batch PDF ({cards.length} card{cards.length === 1 ? "" : "s"})
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer nav */}
          <div className="super-console mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e7eaf0] bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#6c7a93] transition-colors hover:bg-[#f6f7f9] disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                className="btn-primary"
              >
                Continue
                <ArrowRight className="size-4" />
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile create/edit — sibling dialog (kept outside the batch dialog so
          the two stacked modals can't steal each other's close/focus state). */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-[460px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <DialogCloseButton onClick={() => setEditOpen(false)} />
          <div className="flex items-start justify-between gap-4 mb-2 pr-8">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">
                {editDraft.id ? "Edit print profile" : "New print profile"}
              </div>
              <div className="mt-0.5 text-[12.5px] font-medium text-[#6c7a93]">
                Artwork your batch printout sits on. Upload images like you would on a location card.
              </div>
            </div>
          </div>
          <div className="super-console">
            <div className="flex flex-col gap-3">
              <div className="field">
                <label className="field-label" htmlFor="print-profile-name">
                  Name *
                </label>
                <input
                  id="print-profile-name"
                  className="field-value input"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  placeholder="e.g. Coral front / plain back"
                />
              </div>
              <ImageUploadField
                label="Front image (optional)"
                value={editDraft.front}
                onChange={(v) => setEditDraft((d) => ({ ...d, front: v }))}
              />
              <ImageUploadField
                label="Back image (optional)"
                value={editDraft.back}
                onChange={(v) => setEditDraft((d) => ({ ...d, back: v }))}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={busy}
className="btn-primary flex-1"
                  >
                    {busy ? "Saving…" : "Save profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-[#e7eaf0] bg-white px-4 py-2.5 text-[13px] font-bold text-[#6c7a93]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}