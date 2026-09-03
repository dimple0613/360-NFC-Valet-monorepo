import { redis } from "./redis-client";

// NFR-2: rate limiting is part of the security bar (brute-force/credential-
// stuffing mitigation on auth endpoints — login, MFA verify, signup,
// password-reset request). Backed by the same Redis instance already used
// for feature-flag caching (redis-client.ts) rather than an in-memory
// counter: an in-memory counter resets on every restart and doesn't
// coordinate across multiple app instances, which a real deployment of this
// boilerplate will have — no real protection would survive either of those.
//
// Fixed-window counter (INCR + EXPIRE-on-first-increment), not a sliding
// window or token bucket: simplest correct primitive for this use case. The
// accepted tradeoff is the classic fixed-window boundary burst (up to ~2x
// the limit across a window edge) — irrelevant for slowing down brute force,
// which is what this exists for. There's also a narrow, accepted race
// between the INCR and the EXPIRE (a crash in between leaves the key
// without a TTL) — same category of documented, non-fixed race as
// Invoice.number's per-org sequencing in billing/invoices.ts.

export class RateLimitExceededError extends Error {
  constructor(
    public readonly key: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(`Rate limit exceeded for "${key}". Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitExceededError";
  }
}

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Non-throwing check — use when the caller needs to degrade gracefully (e.g. an enumeration-safe "submitted: true" response) rather than surface an error. */
export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, options.windowSeconds);
  }
  const ttl = await redis.ttl(redisKey);
  const retryAfterSeconds = ttl > 0 ? ttl : options.windowSeconds;

  return {
    allowed: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds,
  };
}

/** Throwing variant — matches the rest of the codebase's typed-error pattern (InvalidCredentialsError, ResourceQuotaExceededError, etc.) for callers that want a catchable failure instead of a boolean. */
export async function enforceRateLimit(key: string, options: RateLimitOptions): Promise<void> {
  const result = await checkRateLimit(key, options);
  if (!result.allowed) throw new RateLimitExceededError(key, result.retryAfterSeconds);
}
