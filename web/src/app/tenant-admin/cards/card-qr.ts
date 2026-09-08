import QRCode from "qrcode";

export function guestCardUrl(uid: string, guestBase?: string): string {
  const segment = `/t/${encodeURIComponent(uid)}`;
  const base = guestBase || process.env.NEXT_PUBLIC_GUEST_BASE;
  if (base) {
    try {
      return new URL(segment, base).toString();
    } catch {
      return segment;
    }
  }
  return segment;
}

export function generateCardQr(uid: string, guestBase?: string): Promise<string> {
  return QRCode.toDataURL(guestCardUrl(uid, guestBase), {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}