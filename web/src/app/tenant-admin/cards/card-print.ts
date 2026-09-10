import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { guestCardUrl } from "./card-qr";

// One card FACE to place on the sheet. A face can be the card's front (drawn
// over the front artwork with the QR + UID overlaid) or its back (plain
// artwork, no QR). The print designer resolves each selected card into the
// faces it wants (front and/or back) then hands them all to the PDF builder.
export type PrintCardFace = {
  uid: string;
  property?: string | null;
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

// A4 portrait in mm.
const PAGE_H = 297;
const MARGIN = 12;
const GAP = 8;

const CARDS_PER_COL = 2;
const CARDS_PER_ROW = 3;
const CARDS_PER_PAGE = CARDS_PER_COL * CARDS_PER_ROW;

// Physical card size in mm. Standard CR80 credit-card format.
export const PRINT_CARD_W_MM = 85.6;
export const PRINT_CARD_H_MM = 54;

const CARD_W = PRINT_CARD_W_MM;
const CARD_H = PRINT_CARD_H_MM;

function cardCell(index: number): { col: number; row: number } {
  return { col: index % CARDS_PER_ROW, row: Math.floor(index / CARDS_PER_ROW) % CARDS_PER_COL };
}

function cellPosition(col: number, row: number): { x: number; y: number } {
  return {
    x: MARGIN + col * (CARD_W + GAP),
    y: MARGIN + row * (CARD_H + GAP),
  };
}

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

async function qrPng(uid: string, guestBase?: string): Promise<string> {
  const url = guestCardUrl(uid, guestBase);
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export async function buildCardPrintPdf(options: CardPrintOptions): Promise<{
  blob: Blob;
  filename: string;
  pageCount: number;
  faceCount: number;
}> {
  const { faces, guestBase, title } = options;
  if (!faces.length) throw new Error("No cards to print.");

  const placement: QrPlacement = { ...DEFAULT_PLACEMENT, ...(options.placement || {}) };
  const size: number = placement.sizeMm ?? DEFAULT_PLACEMENT.sizeMm ?? 26;
  const uidPlacement: UidPlacement = { ...DEFAULT_UID_PLACEMENT, ...(options.uidPlacement || {}) };
  const uidSize: number = uidPlacement.size ?? DEFAULT_UID_PLACEMENT.size ?? 12;
  const uidColor: string = uidPlacement.color ?? DEFAULT_UID_PLACEMENT.color ?? "#1c2b46";

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const totalPages = Math.max(1, Math.ceil(faces.length / CARDS_PER_PAGE));

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(230, 234, 240);

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage("a4", "portrait");
    const pageFaces = faces.slice(p * CARDS_PER_PAGE, p * CARDS_PER_PAGE + CARDS_PER_PAGE);

    for (let i = 0; i < pageFaces.length; i++) {
      const face = pageFaces[i];
      const { col, row } = cardCell(i);
      const pos = cellPosition(col, row);

      // Card backing + border.
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pos.x, pos.y, CARD_W, CARD_H, 3, 3, "FD");

      // Artwork (front or back image) fills the whole card face.
      if (face.imageUrl) {
        try {
          doc.addImage(face.imageUrl, "PNG", pos.x, pos.y, CARD_W, CARD_H, undefined, "SLOW");
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
          pos.x,
          pos.y,
          uidPlacement.preset,
          uidSize,
          uidPlacement.xMm,
          uidPlacement.yMm,
        );
        doc.text(face.uid, point.x, point.y, { align: point.align });
      }

      if (face.drawQr) {
        const dataUrl = await qrPng(face.uid, guestBase);
        const rect = resolveQrRect(pos.x, pos.y, placement.preset, size, placement.xMm, placement.yMm);
        doc.addImage(dataUrl, "PNG", rect.x, rect.y, size, size, undefined, "FAST");

        // Tiny URL under the QR.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        doc.setTextColor(150, 160, 180);
        doc.text(`t/${encodeURIComponent(face.uid)}`, rect.x + size / 2, rect.y + size + 3.5, {
          align: "center",
        });
      }
    }

    if (title && p === 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(150, 160, 180);
      doc.text(title.toUpperCase(), MARGIN, PAGE_H - 8);
      doc.setTextColor(20, 30, 55);
    }
  }

  const filename = `nfc-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/pdf" });
  return { blob, filename, pageCount: totalPages, faceCount: faces.length };
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
