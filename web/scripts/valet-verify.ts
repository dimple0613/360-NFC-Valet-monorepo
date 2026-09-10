import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

loadEnv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const v = await pool.query(
    `SELECT v.id, v.order_id, v.offer_id, v.qty, o.plate, o.status, o.zone, o.slot, c.status AS card_status
     FROM validations v JOIN orders o ON o.id = v.order_id JOIN nfc_cards c ON c.id = o.card_id`
  );
  console.log("VALIDATIONS:", JSON.stringify(v.rows));
}
main().then(() => pool.end());