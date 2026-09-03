// Browser-side WebSocket helpers for the live tenant-admin surfaces (queue,
// offers). The main `session_token` cookie is HttpOnly, so a client component
// can't present the session to the WS server. Instead the server (see
// lib/auth/ws-token.ts) also sets a short-lived, non-HttpOnly `valet_ws_token`
// cookie on login/impersonation; this module reads that cookie and hands the
// value to the WebSocket as an auth query/subprotocol so the WS server can
// validate identity before streaming events.

export const WS_TOKEN_COOKIE_NAME = "valet_ws_token";

export function getWsToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; *)valet_ws_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// NEXT_PUBLIC_WS_URL is commonly configured as an http:// URL (hits the
// broadcast endpoint) while the browser socket is ws:// — normalize the scheme
// so the same env var works for both.
export function wsUrlForBrowser(): string {
  const raw =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL
      ? (process.env.NEXT_PUBLIC_WS_URL as string)
      : "ws://localhost:3002";
  return raw.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

/** Opens an authenticated WebSocket to the live endpoint, using the readable WS token. */
export function connectAuthedWs(): WebSocket | null {
  if (typeof WebSocket === "undefined") return null;
  let url: string;
  try {
    url = wsUrlForBrowser();
  } catch {
    return null;
  }
  const token = getWsToken();
  try {
    // Prefer a distinct path so the WS server can route authenticated admin
    // sockets separately from the public guest socket.
    const target = new URL(url);
    target.pathname = "/live/admin";
    target.searchParams.set("token", token ?? "");
    return new WebSocket(target.toString());
  } catch {
    return null;
  }
}
