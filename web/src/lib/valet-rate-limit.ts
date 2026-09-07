// Lightweight in-memory rate limiter for the public guest endpoints
// (/api/public/tap, /api/public/offer/validate). Mirrors the legacy admin's
// lib/rateLimit.js: fixed-window, keyed by IP + path. In-memory is fine here —
// guests hit a single Next server per environment and the window only needs to
// shed abusive tap/validate bursts, not provide cross-instance precision.

const buckets = new Map<string, { start: number; count: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  return cf || "unknown";
}

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

export function rateLimit(req: Request, { max = 20, windowMs = 60000 }: RateLimitOptions = {}): boolean {
  const url = new URL(req.url);
  const key = `${clientIp(req)}:${url.pathname}`;
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > CLEANUP_INTERVAL) buckets.delete(key);
  }
}, CLEANUP_INTERVAL);