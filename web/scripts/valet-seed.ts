import { randomBytes, scryptSync } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

loadEnv({ path: fileURLToPath(new URL("../../packages/db/.env", import.meta.url)) });
loadEnv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const prop = await pool.query(
    `INSERT INTO properties (name, area, city, slug, zones_count, slots_count, card_pool, uid_start)
     SELECT '360 Tower', 'Downtown', 'Dubai', '360-tower', 4, 160, 200, 7001
     WHERE NOT EXISTS (SELECT 1 FROM properties WHERE slug = '360-tower')
     RETURNING id`
  );
  const propertyId = prop.rows[0]?.id;
  console.log("property:", propertyId);

  const driver = await pool.query(
    `INSERT INTO drivers (valet_id, full_name, initials, avatar_color, email, password_hash, property_id, status, role)
     SELECT 'VD-2301', 'Karim Valet', 'KV', '#1C2B46', 'driver@360test.com', $1, $2, 'off_duty', 'driver'
     WHERE NOT EXISTS (SELECT 1 FROM drivers WHERE valet_id = 'VD-2301')
     RETURNING id`,
    [hashPassword("valet123"), propertyId ?? null]
  );
  console.log("driver:", driver.rows[0]?.id);

  const card = await pool.query(
    `INSERT INTO nfc_cards (uid, physical_uid, property_id, status, uses_count)
     SELECT '7001', NULL, $1, 'ready', 0
     WHERE NOT EXISTS (SELECT 1 FROM nfc_cards WHERE uid = '7001')
     RETURNING id`,
    [propertyId]
  );
  console.log("card:", card.rows[0]?.id);

  const offer = await pool.query(
    `INSERT INTO offers (property_id, title, category, price, was_price, description, live, draft, validates_valet, rating, reviews, staff_code, level)
     SELECT $1, 'Valet Coffee Voucher', 'Coffee', 15.00, 25.00, 'Free upgrade with your valet drop.', true, false, true, 4.8, 34, '1234', 'Gold'
     WHERE NOT EXISTS (SELECT 1 FROM offers WHERE title = 'Valet Coffee Voucher')
     RETURNING id`,
    [propertyId]
  );
  console.log("offer:", offer.rows[0]?.id);
}

main().then(() => pool.end()).catch((err) => { console.error(err); process.exit(1); });