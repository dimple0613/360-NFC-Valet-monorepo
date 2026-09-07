import { config } from "dotenv";
import * as path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../../packages/db/.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const orgARes = await pool.query("SELECT id FROM organizations WHERE name = $1", ["Audit Tenant A"]);
    console.log("orgA rows:", JSON.stringify(orgARes.rows));
    const orgA = orgARes.rows[0]?.id;
    await pool.query("UPDATE drivers SET organization_id = $1 WHERE id = 1", [orgA]);
    const d = await pool.query("SELECT id, valet_id, property_id, organization_id FROM drivers WHERE id = 1");
    console.log("driver rows:", JSON.stringify(d.rows));
  } catch (e: any) {
    console.log("ERROR:", e.message.split("\n")[0]);
  }
  await pool.end();
  process.exit(0);
})();