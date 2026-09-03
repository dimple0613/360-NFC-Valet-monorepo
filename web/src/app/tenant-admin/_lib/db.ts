import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

// Tenant-admin valet pages now read/write the SAME platform database that
// Prisma manages (the merged single DB), instead of the separate legacy valet
// database. The tables (properties, zones, drivers, nfc_cards, offers, orders,
// validations) are created by Prisma migrations in this DB.
//
// No auto-schema ensure here: table ownership is Prisma's, and creating the
// legacy auth tables (tenants/roles/admins) here would collide with the
// platform's own tables. The connection uses DATABASE_URL (the platform DB).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  options: "-c client_encoding=utf8",
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function transaction<T>(
  fn: (exec: (text: string, params?: unknown[]) => Promise<QueryResult>) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
export type { PoolClient };
