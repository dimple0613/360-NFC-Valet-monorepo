import QRCode from "qrcode";

export function guestCardUrl(
  uid: string,
  guestBase?: string,
  propertySlug?: string | null,
  guestToken?: string | null,
): string {
  const slug = propertySlug?.trim();
  const segmentId = guestToken || uid;
  const segment = slug
    ? `/${encodeURIComponent(slug)}/${encodeURIComponent(segmentId)}`
    : `/t/${encodeURIComponent(segmentId)}`;
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

export function generateCardQr(
  uid: string,
  guestBase?: string,
  propertySlug?: string | null,
  guestToken?: string | null,
): Promise<string> {
  return QRCode.toDataURL(guestCardUrl(uid, guestBase, propertySlug, guestToken), {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}