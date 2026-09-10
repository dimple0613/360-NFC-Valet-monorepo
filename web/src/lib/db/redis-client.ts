import Redis from "ioredis";

// FR-192: feature flag checks are cached. First Redis usage in this codebase
// (CLAUDE.md's stack notes Redis for cache/queues/real-time, unused until
// now) — same singleton-with-hot-reload-guard pattern as the Prisma client
// in client.ts.

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis = globalThis.__redis ?? new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
