import Redis from "ioredis";

// FR-192: feature flag checks are cached. First Redis usage in this codebase
// (CLAUDE.md's stack notes Redis for cache/queues/real-time, unused until
// now) — same singleton-with-hot-reload-guard pattern as the Prisma client
// in client.ts.

// Cloudflare Workers (workerd) detection — same marker Prisma's runtimes use
// (`navigator.userAgent === "Cloudflare-Workers"`); `process.versions` is not
// reliable because workerd synthesizes `process.versions.node` under
// nodejs_compat and doesn't expose `.workerd`. workerd has no TCP sockets, so
// a real ioredis client cannot connect there — feature-flag caching
// (billing/features.ts) and rate limiting (rate-limit.ts) fall back to an
// in-memory store instead (per-isolate, non-coordinating, fine for the
// moment). Local dev / Vercel keep the real Redis.
const IS_WORKERS_RUNTIME =
  typeof navigator !== "undefined" &&
  navigator?.userAgent === "Cloudflare-Workers";

interface IRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  disconnect(): void;
}

/** Minimal in-memory stand-in for the ioredis methods this codebase uses. */
class MemoryRedis implements IRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: "EX", ttlSeconds?: number): Promise<"OK"> {
    const expiresAt = mode === "EX" && ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const current = (await this.get(key)) ?? "0";
    const next = (parseInt(current, 10) || 0) + 1;
    const existing = this.store.get(key);
    this.store.set(key, { value: String(next), expiresAt: existing?.expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === undefined) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    if (remaining <= 0) {
      this.store.delete(key);
      return -2;
    }
    return remaining;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    return [...this.store.keys()].filter((key) => regex.test(key));
  }

  disconnect(): void {
    // no-op
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | IRedis | undefined;
}

export const redis: IRedis = IS_WORKERS_RUNTIME
  ? new MemoryRedis()
  : globalThis.__redis ?? new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (!IS_WORKERS_RUNTIME && process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}