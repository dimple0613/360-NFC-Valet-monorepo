import { config } from "dotenv";
import * as path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  await pool.query("UPDATE orders SET status='parked', guest_eta=NULL WHERE id = 1");
  const r = await pool.query(
    "SELECT id, status, guest_eta, plate FROM orders WHERE id = 1"
  );
  console.log("order:", JSON.stringify(r.rows[0]));
  const c = await pool.query("SELECT id, uid, status FROM nfc_cards WHERE id = 1");
  console.log("card:", JSON.stringify(c.rows[0]));
  await pool.end();
  process.exit(0);
})();