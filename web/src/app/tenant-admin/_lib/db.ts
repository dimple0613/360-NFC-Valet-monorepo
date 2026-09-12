import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool, QueryResult, QueryResultRow } from "pg";
import type { PoolClient } from "pg";

// Workerd detection. Same marker Prisma's own runtimes (and
// src/lib/db/client.ts) trust: workerd always reports this userAgent, plain
// Node does not.
const IS_WORKERS_RUNTIME =
  typeof navigator !== "undefined" &&
  navigator?.userAgent === "Cloudflare-Workers";

// Tenant-admin valet pages now read/write the SAME platform database that
// Prisma manages (the merged single DB), instead of the separate legacy valet
// database. The tables (properties, zones, drivers, nfc_cards, offers, orders,
// validations) are created by Prisma migrations in this DB.
//
// No auto-schema ensure here: table ownership is Prisma's, and creating the
// legacy auth tables (tenants/roles/admins) here would collide with the
// platform's own tables. The connection uses DATABASE_URL (the platform DB) --
// except on Cloudflare Workers, where the Hyperdrive binding is the only
// connection string available (DATABASE_URL is not in wrangler vars).
function resolveConnectionString(): string {
  if (IS_WORKERS_RUNTIME) {
    try {
      const ctx = getCloudflareContext({ async: false });
      const hyperdrive = ctx.env.HYPERDRIVE as { connectionString?: string } | undefined;
      if (hyperdrive?.connectionString) return hyperdrive.connectionString;
    } catch {
      // Hyperdrive unavailable this request; fall back to the env var.
    }
  }
  return process.env.DATABASE_URL ?? "";
}

// Long-lived process (Next dev, standalone scripts): keep the pooled client,
// which is safe because the process outlives every request.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  options: "-c client_encoding=utf8",
});

/**
 * Run `fn` against a single pg connection and tear it down before returning.
 *
 * On Cloudflare Workers a pooled, idle pg client cannot be reused across
 * requests: the socket (and the query continuation waiting on it) is created
 * inside one request context, so resolving a later request's query on it emits
 * "A promise was resolved or rejected from a different request context than the
 * one it was created in." Node stays on the pool; Workers use a fresh Client
 * per operation (same lifecycle rule the Prisma adapter enforces with
 * `maxUses: 1` in src/lib/db/client.ts), ended before the request returns.
 */
async function withPgClient<T>(
  fn: (client: Client) => Promise<T>
): Promise<T> {
  if (IS_WORKERS_RUNTIME) {
    const client = new Client({
      connectionString: resolveConnectionString(),
      options: "-c client_encoding=utf8",
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return withPgClient((client) => client.query<T>(text, params));
}

export async function transaction<T>(
  fn: (exec: (text: string, params?: unknown[]) => Promise<QueryResult>) => Promise<T>
): Promise<T> {
  return withPgClient(async (client) => {
    try {
      await client.query("BEGIN");
      const result = await fn((text, params) => client.query(text, params));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

export { pool };
export type { PoolClient };
