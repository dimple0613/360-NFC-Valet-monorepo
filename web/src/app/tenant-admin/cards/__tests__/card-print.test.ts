import { describe, expect, it } from "vitest";
import { buildCardPrintPdf } from "../card-print";

describe("buildCardPrintPdf", () => {
  it("rejects an empty face list", async () => {
    await expect(buildCardPrintPdf({ faces: [] })).rejects.toThrow("No cards to print.");
  });

  it("produces a single-page PDF blob for one front face", async () => {
    const out = await buildCardPrintPdf({
      faces: [{ uid: "NFC-10001", drawQr: true, drawUid: true }],
    });
    expect(out.faceCount).toBe(1);
    expect(out.pageCount).toBe(1);
    expect(out.blob.type).toBe("application/pdf");
    expect(out.filename).toMatch(/^nfc-cards-\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = Buffer.from(await out.blob.arrayBuffer());
    // PDF header magic `%PDF`.
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("renders one card face per business-card-sized page", async () => {
    const faces = Array.from({ length: 7 }, (_, i) => ({ uid: `NFC-${10000 + i}`, drawQr: true }));
    const out = await buildCardPrintPdf({ faces });
    expect(out.faceCount).toBe(7);
    expect(out.pageCount).toBe(7);
  });

  it("renders front + back faces from a chosen profile placement", async () => {
    const out = await buildCardPrintPdf({
      faces: [
        { uid: "DSF-00121", property: "360 Tower", drawQr: true, drawUid: true },
        { uid: "DSF-00121", property: "360 Tower" },
      ],
      placement: { preset: "top-right", sizeMm: 30 },
      uidPlacement: { preset: "bottom-center", size: 12 },
      guestBase: "http://localhost:3001",
    });
    expect(out.faceCount).toBe(2);
  });

  it("supports the per-side split: QR on the front face, UID on the back face", async () => {
    const out = await buildCardPrintPdf({
      faces: [
        { uid: "DSF-00123", imageUrl: undefined, drawQr: true, drawUid: false },
        { uid: "DSF-00123", imageUrl: undefined, drawQr: false, drawUid: true },
      ],
      placement: { preset: "bottom-right", sizeMm: 26 },
      uidPlacement: { preset: "top-center", size: 12 },
      guestBase: "http://localhost:3001",
    });
    expect(out.faceCount).toBe(2);
    expect(out.pageCount).toBe(2);
    expect(out.blob.type).toBe("application/pdf");
  });

  it("front and back of each card land on consecutive pages", () => {
    const pair = [
      { uid: "DSF-00121", drawQr: true },
      { uid: "DSF-00121", drawQr: false },
    ];
    expect(buildCardPrintPdf({ faces: pair })).resolves.toMatchObject({
      pageCount: 2,
      faceCount: 2,
    });
  });
});
