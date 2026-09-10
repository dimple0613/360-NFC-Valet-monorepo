import { config } from "dotenv";
import * as path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (label: string, sql: string) => {
  try {
    const r = await pool.query(sql);
    console.log(label + ":", JSON.stringify(r.rows));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(label + ": ERROR", msg.split("\n")[0]);
  }
};
(async () => {
  await q("memberships", 'SELECT id, "userId", "organizationId", status FROM organization_memberships');
  await q("platform_user_roles", 'SELECT "userId", "platformRoleId" FROM platform_user_roles');
  await q("roles", 'SELECT id, "organizationId", slug, name FROM roles ORDER BY slug');
  await q("user_roles", 'SELECT "userId", "roleId", "organizationId" FROM user_roles');
  await q("sessions", 'SELECT id, "userId", "organizationId" FROM sessions');
  await q("properties", 'SELECT id, name, "organizationId", slug FROM properties');
  await pool.end();
})();