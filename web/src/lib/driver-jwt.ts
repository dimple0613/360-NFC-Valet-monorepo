import { createHmac, timingSafeEqual } from "node:crypto";

// Driver tokens are plain HS256 JWTs (base64url body + HMAC-SHA256 signature),
// exactly the shape the legacy driver app and old WS server already exchange —
// the driver app stores the token opaque and sends it as `Authorization:
// Bearer <token>` plus `auth: { token, role: 'driver' }` on the socket, and the
// old ws-server validated `body.sig` with the same HMAC. We keep that wire
// format so the existing app/socket clients keep working untouched.
//
// Payload: { type: 'driver', driverId, valetId, propertyId, iat, exp }.
// propertyId intentionally lives in the token because a driver selects a
// location when starting a shift and the socket/room membership follows it.

export interface DriverClaims {
  type: "driver";
  driverId: number;
  valetId: string;
  propertyId: number | null;
  iat: number;
  exp: number;
}

export const DRIVER_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days (covers a shift + break)

function signingSecret(): string {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function signDriverToken(payload: {
  driverId: number;
  valetId: string;
  propertyId?: number | null;
  ttlSec?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: DriverClaims = {
    type: "driver",
    driverId: payload.driverId,
    valetId: payload.valetId,
    propertyId: payload.propertyId ?? null,
    iat: now,
    exp: now + (payload.ttlSec ?? DRIVER_TOKEN_TTL_SEC),
  };
  const body = base64url(JSON.stringify(claims));
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDriverToken(token: string | null | undefined): DriverClaims | null {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DriverClaims;
    if (claims?.type !== "driver") return null;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (!claims.driverId || !claims.valetId) return null;
    return claims;
  } catch {
    return null;
  }
}