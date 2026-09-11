import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

loadEnv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const counts = await pool.query(
    `SELECT 'properties' t, count(*)::int n FROM properties
     UNION ALL SELECT 'nfc_cards', count(*)::int FROM nfc_cards
     UNION ALL SELECT 'drivers', count(*)::int FROM drivers
     UNION ALL SELECT 'offers', count(*)::int FROM offers
     UNION ALL SELECT 'orders', count(*)::int FROM orders
     UNION ALL SELECT 'validations', count(*)::int FROM validations`
  );
  console.log("COUNTS:", JSON.stringify(counts.rows));

  const props = await pool.query("SELECT id, name, slug, city, uid_start FROM properties ORDER BY id LIMIT 5");
  console.log("PROPERTIES:", JSON.stringify(props.rows));

  const cards = await pool.query(
    `SELECT c.id, c.uid, c.physical_uid, c.property_id, c.status, c.uses_count
     FROM nfc_cards c ORDER BY c.id DESC LIMIT 5`
  );
  console.log("CARDS:", JSON.stringify(cards.rows));

  const drivers = await pool.query(
    `SELECT d.id, d.valet_id, d.full_name, d.status, d.property_id, d.password_hash IS NOT NULL AS has_pw, d.token_version
     FROM drivers d ORDER BY d.id LIMIT 5`
  );
  console.log("DRIVERS:", JSON.stringify(drivers.rows));

  const offers = await pool.query(
    `SELECT id, title, category, live, draft, staff_code, validates_valet, property_id FROM offers ORDER BY id LIMIT 5`
  );
  console.log("OFFERS:", JSON.stringify(offers.rows));

  const orders = await pool.query(
    `SELECT id, property_id, card_id, driver_id, plate, status FROM orders ORDER BY id DESC LIMIT 5`
  );
  console.log("ORDERS:", JSON.stringify(orders.rows));

  const orgs = await pool.query(
    `SELECT id, name, slug, status FROM organizations ORDER BY "createdAt" LIMIT 10`
  );
  console.log("ORGS:", JSON.stringify(orgs.rows));
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });