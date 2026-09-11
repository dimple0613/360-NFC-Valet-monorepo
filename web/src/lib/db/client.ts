import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PrismaClient } from "./generated/client";
import { PrismaClient as PrismaClientNode } from "./generated/client";
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
 * PrismaClient constructor for the current runtime. On Workers the edge/WASM
 * entry point is required — it uses the query compiler (pure JS) when
 * `queryCompiler` is enabled, so no WASM binary is loaded at runtime.
 */
function getClientConstructor(): typeof PrismaClientNode {
  if (IS_WORKERS_RUNTIME) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const edgeClient = require("./generated/client/edge") as typeof import("./generated/client");
    return edgeClient.PrismaClient;
  }
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
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
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
 * Prisma's driver adapter. `maxUses: 1` is the documented Workers-safe
 * setting — a connection is used for at most one query cycle so the pool
 * never hands out a stale/socket-migrated connection between the isolate's
 * sequential requests. That same setting is a footgun everywhere else:
 * every query opens a fresh TLS connection, which against a pooled host like
 * Neon's pgbouncer (and Hyperdrive's proxy) turns each query into a full
 * connect+SSL handshake and makes bulk work (seeds, imports) take minutes.
 * Plain Node/Vercel reuse the pool.
 */
function buildAdapter(): PrismaPg {
  return new PrismaPg({
    connectionString: resolveConnectionString(),
    maxUses: IS_WORKERS_RUNTIME ? 1 : undefined,
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