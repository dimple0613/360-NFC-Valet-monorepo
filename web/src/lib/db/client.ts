import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientNode } from "@prisma/client";
import { tenantScopingExtension } from "./tenant-scoping";

// Cloudflare Workers (workerd) detection. `process.versions.node` is NOT a
// reliable marker: workerd synthesizes it under nodejs_compat, and it does
// not reliably expose `process.versions.workerd`. The marker Prisma's own
// runtimes trust (same string they check in every bundled runtime) is the
// `navigator.userAgent` workerd always reports. Node 21+ also defines a global
// `navigator`, but its userAgent is "Node.js/<version>", so the exact match
// stays unambiguous.
const IS_WORKERS_RUNTIME =
  typeof navigator !== "undefined" &&
  navigator?.userAgent === "Cloudflare-Workers";

/**
 * PrismaClient constructor for the current runtime. With the query compiler
 * default in Prisma 6.19.3 and `engineType = "client"`, no native engine is
 * needed on any platform — the same client class is valid under plain Node,
 * Vercel, and workerd.
 */
function getClientConstructor(): typeof PrismaClientNode {
  return PrismaClientNode;
}

// Vercel/Lambda-only fallback: Prisma's own runtime search for the query
// engine binary tries a fixed set of guessed root/subpath combinations
// (confirmed via a real production PrismaClientInitializationError listing
// its search paths) that don't include this project's actual monorepo
// layout — packages/db/generated/client relative to the Lambda's actual
// working directory. Rather than guess which of Prisma's own guesses might
// eventually match, point it at the real file directly if we can find it;
// this only ever runs on Linux (the deployed target), so local dev (Windows,
// where Prisma's default search already works fine) is untouched.
if (!IS_WORKERS_RUNTIME && process.platform === "linux" && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engineFilename = "libquery_engine-rhel-openssl-3.0.x.so.node";
  const candidateDirs = [
    path.join(process.cwd(), "packages/db/generated/client"),
    path.join(process.cwd(), "../packages/db/generated/client"),
    path.join(__dirname, "../generated/client"),
  ];
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, engineFilename);
    if (existsSync(candidate)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
      break;
    }
  }
}

declare global {
  var __prisma: PrismaClient | undefined;
  var __prismaDb: PrismaClient | undefined;
}

/**
 * Database URL resolution:
 * - On Cloudflare Workers, the Hyperdrive binding serves a pooled, cached
 *   `connectionString` pointed at the Neon DB — that's what gets used so
 *   queries ride Hyperdrive's connection pool instead of hitting Neon cold.
 * - Everywhere else (local dev, Vercel, tests) we fall back to DATABASE_URL.
 */
function resolveConnectionString(): string {
  if (IS_WORKERS_RUNTIME) {
    try {
      const ctx = getCloudflareContext({ async: false });
      const hyperdrive = ctx.env.HYPERDRIVE as { connectionString?: string } | undefined;
      if (hyperdrive?.connectionString) {
        console.log("[DB] Using Hyperdrive connection string");
        return hyperdrive.connectionString;
      }
      console.error("[DB] Hyperdrive binding found but no connectionString");
    } catch (e) {
      console.error("[DB] getCloudflareContext failed:", e);
    }
  }
  const url = process.env.DATABASE_URL ?? "";
  console.log("[DB] Using DATABASE_URL, length:", url.length, "starts:", url.substring(0, 30));
  return url;
}

/**
 * Prisma's driver adapter.
 *
 * On Workers the pool is a tiny persistent pool that follows Cloudflare's
 * Hyperdrive+Prisma guidance (no fresh connections per query). Everything
 * else follows from that being the only way this platform's data plane stays
 * reliable under workerd:
 *
 * - A bigger pool (and the old `maxUses: 1`) meant every query opened a
 *   fresh raw TLS connection. In dev the Hyperdrive binding's
 *   `localConnectionString` points straight at the Neon pooler, and workerd's
 *   outbound connect to that host is flaky (its IPv6/Happy-Eyeballs path on a
 *   NAT'd Windows box stalls with neither a resolve nor an error). Throw
 *   concurrent requests at that and you get a connection storm: stalls pile
 *   up, the runtime cancels the hung requests ("code had hung"), and the
 *   orphaned sockets' late data events fire inside whatever new request
 *   happens to be running (the cross-request promise warnings + ECONNRESETs).
 *   pg-pool's connect timeout only destroys the stuck socket; workerd never
 *   delivers the connect callback, so the pool just starts another stalled
 *   connect for the next queued caller (retry churn).
 * - `max: 2` caps concurrent connect attempts (and stays far below even a
 *   single Worker's fair share of a real Hyperdrive edge pool in production).
 *   Concurrent requests share the two persistent connections instead of
 *   racing to open sockets, so there is no storm once connections exist, while
 *   two sockets give heavy pages enough headroom that a burst of concurrent
 *   loads doesn't serialize into queue timeouts.
 * - `max: 2` connections that sit idle get reaped by pg-pool's default 10s
 *   idle timeout, by NAT, or by the pgBouncer idle timeout — and the next
 *   request would then have to do another flaky fresh connect.
 *   `idleTimeoutMillis: 300_000` stops pg-pool from tearing them down, and
 *   `startKeepaliveIfWorkers()` pings every 20s so external idles can't reap
 *   the sockets either. The flaky connect path therefore only runs once per
 *   isolate cold start.
 * - `connectionTimeoutMillis` bounds the flaky connect so a genuine stall
 *   surfaces as a normal query error instead of a request that hangs forever.
 *
 * Plain Node/Vercel keep the default pool (no cap, connection reuse, no
 * keepalive).
 */
function buildAdapter(): PrismaPg {
  return new PrismaPg({
    connectionString: resolveConnectionString(),
    max: IS_WORKERS_RUNTIME ? 2 : undefined,
    // Bounded but generous: measured workerd→Neon connects (dev Hyperdrive
    // passthrough) can take several seconds, and concurrent pages serialize
    // through the 2 sockets (each page is several Neon round-trips). A short
    // timeout would kill legitimate slow connects / queues and turn pages
    // into 500s; 45s only fires for a genuinely dead/stalled connection.
    connectionTimeoutMillis: 45_000,
    // pg-pool defaults to tearing an idle client down after 10s (see
    // pg-pool/index.js, `_release`). With `max: 2` on Workers that would
    // destroy the pooled socket constantly — every pause between pages forces
    // the flaky fresh connect again. Keep idle clients around for 5 minutes;
    // the keepalive below additionally carries traffic every 20s so external
    // idles (NAT, pgBouncer) never reap it either.
    idleTimeoutMillis: IS_WORKERS_RUNTIME ? 300_000 : undefined,
  });
}

/**
 * The raw, unscoped client. Reserved for the Super Admin portal, migrations, and
 * seed/maintenance scripts that must legitimately operate across organizations.
 * Do not import this into tenant-facing request/job handling.
 *
 * This also bypasses AuditLog's immutability guard (tenant-scoping.ts only wraps
 * `db`, not this client) — nothing stops `prismaWithoutTenantScoping.auditLog.update(...)`
 * at the application layer. Enforcing that at the DB level too (e.g. revoking
 * UPDATE/DELETE on audit_logs from the app role) is real hardening worth doing before
 * production, not done here — treat this export as trusted-code-only in the meantime.
 */
/**
 * Keeps the Workers-only persistent connections alive. Pooled connections that
 * go idle get reaped by the network (NAT) or the proxy (pgBouncer session
 * idle timeout), and the reconnect path is the flaky workerd→Neon connect
 * described in `buildAdapter`. Pinging every 20s means both sockets carry
 * traffic well before anything prunes them, so a running session never needs
 * a fresh remote connect after its initial one.
 *
 * The interval MUST be registered at module scope, NOT while handling a
 * request: workerd cancels timers created inside a request when that request
 * completes, so a keepalive started during the first lazy client init would
 * stop after that first page and the sockets would die between requests. The
 * client itself is still created lazily inside requests (the Hyperdrive
 * binding only exists there), so the ping resolves the current client on each
 * tick and no-ops until one exists.
 *
 * The timer's query completes in a later request context — that is exactly
 * the `no_handle_cross_request_promise_resolution` case the compat flag
 * exists for (see wrangler.jsonc), so the keepalive runs without emitting
 * cross-request promise warnings.
 */
if (IS_WORKERS_RUNTIME) {
  setInterval(() => {
    const client = globalThis.__prisma;
    if (!client) return;
    Promise.resolve(client.$queryRawUnsafe("SELECT 1"))
      .then(() => console.warn("[KA] ok"))
      .catch((e) => console.warn("[KA] fail", String(e.message ?? e).slice(0, 120)));
  }, 20_000).unref?.();
}

function getRawClient(): PrismaClient {
  if (!globalThis.__prisma) {
    const Constructor = getClientConstructor();
    globalThis.__prisma = new Constructor({ adapter: buildAdapter() }) as PrismaClient;
  }
  return globalThis.__prisma;
}

/**
 * The tenant-scoped client. Application code should import and use this, not
 * `prismaWithoutTenantScoping` — see tenant-scoping.ts for what it enforces and
 * tenant-context.ts for how the active tenant gets in and out of scope.
 */
function getScopedClient(): PrismaClient {
  if (!globalThis.__prismaDb) {
    globalThis.__prismaDb = getRawClient().$extends(tenantScopingExtension) as unknown as PrismaClient;
  }
  return globalThis.__prismaDb;
}

// Lazy proxies: on Workers the Hyperdrive binding only exists inside a request,
// so the adapter must be built on first use, not at module import. Property
// access forwards to the real (lazily-created) client; functions are rebound so
// `this` stays correct.
function lazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const client = factory();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    },
    has(_target, prop) {
      return prop in factory();
    },
    ownKeys() {
      return Reflect.ownKeys(factory());
    },
    getOwnPropertyDescriptor() {
      return { configurable: true, enumerable: true, writable: true };
    },
  });
}

export const prismaWithoutTenantScoping = lazyProxy<PrismaClient>(getRawClient);
export const db = lazyProxy<PrismaClient>(getScopedClient);