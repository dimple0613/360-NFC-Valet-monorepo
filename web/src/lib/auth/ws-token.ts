import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Short-lived, NON-HttpOnly WebSocket credential for the live-valet surfaces
// (queue, offers). The browser-side JS cannot read the main `session_token`
// cookie (it is HttpOnly), so a client-mounted component has no way to present
// its session to the WS endpoint. We fix that by ALSO setting a separate,
// deliberately-readable cookie carrying a signed, short-lived token.
//
// Security model: this is NOT the session cookie. It is strictly a scoped
// WebSocket credential that lets the WS server know "this browser proved who
// it is earlier today." It is opaque (the session id), signed with HMAC using
// the same secret governing sessions, and expires in ~1h. It stays readable
// only long enough to open a socket; the main authenticated session cookie
// remains HttpOnly and untouched.
//
// The token is `<sessionId>.<expiryEpochMs>.<hmac>`; the WS server validates
// signature + expiry (and can cross-check the session id against its session
// store). The signing secret lives in JWT_SECRET to avoid adding a new env.

export const WS_TOKEN_COOKIE_NAME = "valet_ws_token";
export const WS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function signingSecret(): string {
  return process.env.JWT_SECRET || process.env.WS_TOKEN_SECRET || "dev-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

/** Verifies a valet_ws_token cookie value; returns the session id or null. */
export function verifyWsToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, expiryMs, mac] = parts;
  const expiry = Number(expiryMs);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  const expected = sign(`${sessionId}.${expiryMs}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

/** Sets the readable, short-lived WS token cookie. Call alongside the session cookie on login. */
export async function setWsTokenCookie(sessionId: string): Promise<void> {
  const expiryMs = Date.now() + WS_TOKEN_TTL_MS;
  const mac = sign(`${sessionId}.${expiryMs}`);
  const token = `${sessionId}.${expiryMs}.${mac}`;
  const cookieStore = await cookies();
  cookieStore.set(WS_TOKEN_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WS_TOKEN_TTL_MS / 1000,
  });
}

export async function clearWsTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WS_TOKEN_COOKIE_NAME);
}
