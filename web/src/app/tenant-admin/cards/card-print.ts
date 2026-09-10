import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { guestCardUrl } from "./card-qr";

// One card FACE to place on the sheet. A face can be the card's front (drawn
// over the front artwork with the QR + UID overlaid) or its back (plain
// artwork, no QR). The print designer resolves each selected card into the
// faces it wants (front and/or back) then hands them all to the PDF builder.
export type PrintCardFace = {
  uid: string;
  guestToken?: string | null;
  property?: string | null;
  propertySlug?: string | null;
  imageUrl?: string | null;
  drawQr?: boolean;
  drawUid?: boolean;
};

// Preset placement for the QR code on the card front. Free X/Y (mm, relative
// to the card's top-left) overrides the preset when given.
export type QrPlacement = {
  preset: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  xMm?: number;
  yMm?: number;
  sizeMm?: number;
};

// Independent placement for the UID text line. QR and UID are deliberately
// separate: each has its own preset, its own free X/Y override, and its own
// size, so the UID can sit on a different corner/edge than the QR code.
export type UidPlacement = {
  preset:
    | "top-center"
    | "bottom-center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
  xMm?: number;
  yMm?: number;
  /** UID font size in points. */
  size?: number;
  /** UID text color as a hex string (e.g. "#1c2b46"). */
  color?: string;
};

export type CardPrintOptions = {
  faces: PrintCardFace[];
  placement?: Partial<QrPlacement>;
  uidPlacement?: Partial<UidPlacement>;
  guestBase?: string;
  title?: string;
};

// Physical card size in mm. Standard CR80 credit-card / business-card format.
export const PRINT_CARD_W_MM = 85.6;
export const PRINT_CARD_H_MM = 54;

const CARD_W = PRINT_CARD_W_MM;
const CARD_H = PRINT_CARD_H_MM;

// Each PDF page is one business-card-sized sheet (CR80) carrying a single card
// face full-bleed, so a print at 100% yields an exact-size card with nothing to
// cut or re-arrange. Front and back of the same card come out on consecutive
// pages. jsPDF's built-in "credit-card" format is the same 85.6 × 54 mm.
const PAGE_W = CARD_W;
const PAGE_H = CARD_H;

const DEFAULT_PLACEMENT: QrPlacement = {
  preset: "bottom-right",
  sizeMm: 26,
};

const DEFAULT_UID_PLACEMENT: UidPlacement = {
  preset: "top-center",
  size: 12,
  color: "#1c2b46",
};

function resolveQrRect(
  x0: number,
  y0: number,
  preset: QrPlacement["preset"],
  size: number,
  freeX?: number,
  freeY?: number,
): { x: number; y: number } {
  if (freeX != null && freeY != null) return { x: x0 + freeX, y: y0 + freeY };
  const pad = 3;
  switch (preset) {
    case "top-left":
      return { x: x0 + pad, y: y0 + pad };
    case "top-right":
      return { x: x0 + CARD_W - pad - size, y: y0 + pad };
    case "bottom-left":
      return { x: x0 + pad, y: y0 + CARD_H - pad - size };
    case "bottom-right":
      return { x: x0 + CARD_W - pad - size, y: y0 + CARD_H - pad - size };
    case "center":
      return { x: x0 + (CARD_W - size) / 2, y: y0 + (CARD_H - size) / 2 };
  }
}

async function qrPng(
  uid: string,
  guestBase?: string,
  propertySlug?: string | null,
  guestToken?: string | null,
): Promise<string> {
  const url = guestCardUrl(uid, guestBase, propertySlug, guestToken);
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export const MAX_PRINT_BATCH = 1000;

export async function buildCardPrintPdf(options: CardPrintOptions): Promise<{
  blob: Blob;
  filename: string;
  pageCount: number;
  faceCount: number;
}> {
  const { faces, guestBase } = options;
  if (!faces.length) throw new Error("No cards to print.");
  if (faces.length > MAX_PRINT_BATCH * 2) {
    throw new Error(`Print at most ${MAX_PRINT_BATCH} cards per batch.`);
  }

  const placement: QrPlacement = { ...DEFAULT_PLACEMENT, ...(options.placement || {}) };
  const size: number = placement.sizeMm ?? DEFAULT_PLACEMENT.sizeMm ?? 26;
  const uidPlacement: UidPlacement = { ...DEFAULT_UID_PLACEMENT, ...(options.uidPlacement || {}) };
  const uidSize: number = uidPlacement.size ?? DEFAULT_UID_PLACEMENT.size ?? 12;
  const uidColor: string = uidPlacement.color ?? DEFAULT_UID_PLACEMENT.color ?? "#1c2b46";

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PAGE_W, PAGE_H],
    compress: true,
  });

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(230, 234, 240);

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    if (i > 0) doc.addPage([PAGE_W, PAGE_H]);

    // The page IS the card: draw full-bleed at 0,0 so no grid math can clip
    // or scatter faces.
    doc.roundedRect(0, 0, CARD_W, CARD_H, 3, 3, "FD");

    // Artwork (front or back image) fills the whole card face.
    if (face.imageUrl) {
      try {
        doc.addImage(face.imageUrl, "PNG", 0, 0, CARD_W, CARD_H, undefined, "SLOW");
      } catch {
        // Ignore a failed artwork embed; fall back to the plain card.
      }
    }

    if (face.drawUid) {
      // UID text line — placed independently of the QR (own preset + free
      // X/Y + size + color).
      doc.setFont("helvetica", "bold");
      doc.setFontSize(uidSize);
      doc.setTextColor(uidColor);
      const point = resolveUidPoint(
        0,
        0,
        uidPlacement.preset,
        uidSize,
        uidPlacement.xMm,
        uidPlacement.yMm,
      );
      doc.text(face.uid, point.x, point.y, { align: point.align });
    }

    if (face.drawQr) {
      const dataUrl = await qrPng(face.uid, guestBase, face.propertySlug, face.guestToken);
      const rect = resolveQrRect(0, 0, placement.preset, size, placement.xMm, placement.yMm);
      doc.addImage(dataUrl, "PNG", rect.x, rect.y, size, size, undefined, "FAST");

      // Tiny URL under the QR: /property-slug/guest-token (falls back to
      // /t/guest-token). Only drawn when it fits inside the card — a QR
      // anchored to the bottom edge has no room below it on a card-sized page.
      if (rect.y + size + 4 <= PAGE_H) {
        const segmentId = face.guestToken || face.uid;
        const underUrl = face.propertySlug
          ? `${encodeURIComponent(face.propertySlug)}/${encodeURIComponent(segmentId)}`
          : `t/${encodeURIComponent(segmentId)}`;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        doc.setTextColor(150, 160, 180);
        doc.text(underUrl, rect.x + size / 2, rect.y + size + 3.5, {
          align: "center",
        });
      }
    }
  }

  const filename = `nfc-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/pdf" });
  return { blob, filename, pageCount: faces.length, faceCount: faces.length };
}

// Resolve where the UID text baseline goes for a given preset. Free X/Y (mm,
// relative to the card's top-left) overrides the preset entirely.
function resolveUidPoint(
  x0: number,
  y0: number,
  preset: UidPlacement["preset"],
  fontSize: number,
  freeX?: number,
  freeY?: number,
): { x: number; y: number; align: "left" | "center" | "right" } {
  if (freeX != null && freeY != null) return { x: x0 + freeX, y: y0 + freeY, align: "center" };
  const pad = 4;
  const padBottom = Math.max(6, fontSize * 0.45 + 3);
  switch (preset) {
    case "top-center":
      return { x: x0 + CARD_W / 2, y: y0 + fontSize + 2, align: "center" };
    case "bottom-center":
      return { x: x0 + CARD_W / 2, y: y0 + CARD_H - padBottom, align: "center" };
    case "top-left":
      return { x: x0 + pad, y: y0 + fontSize + 2, align: "left" };
    case "top-right":
      return { x: x0 + CARD_W - pad, y: y0 + fontSize + 2, align: "right" };
    case "bottom-left":
      return { x: x0 + pad, y: y0 + CARD_H - padBottom, align: "left" };
    case "bottom-right":
      return { x: x0 + CARD_W - pad, y: y0 + CARD_H - padBottom, align: "right" };
    case "center":
      return { x: x0 + CARD_W / 2, y: y0 + CARD_H / 2 + fontSize * 0.35, align: "center" };
  }
}
