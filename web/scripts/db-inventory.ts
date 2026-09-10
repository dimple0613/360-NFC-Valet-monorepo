import { config } from "dotenv";
import * as path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tables = [
  "organizations",
  "users",
  "auth_sessions",
  "properties",
  "drivers",
  "nfc_cards",
  "orders",
  "offers",
  "validations",
  "roles",
  "role_permissions",
  "admins",
  "tenants",
  "driver_reset_tokens",
];
(async () => {
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM ${t}`);
      console.log(`${t}: ${r.rows[0].n}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`${t}: ERROR ${msg.split("\n")[0]}`);
    }
  }
  const re = await pool.query("SELECT email, id FROM users LIMIT 5");
  console.log("users:", JSON.stringify(re.rows));
  const orow = await pool.query("SELECT id, name, slug FROM organizations LIMIT 5");
  console.log("orgs:", JSON.stringify(orow.rows));
  await pool.end();
})();