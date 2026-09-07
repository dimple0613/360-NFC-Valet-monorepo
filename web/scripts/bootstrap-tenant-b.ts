import { config } from "dotenv";
import * as path from "path";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../../packages/db/.env") });

import { signUpNewOrganization } from "../src/lib/auth/signup-flow";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const b = await signUpNewOrganization({
    organizationName: "Audit Tenant B",
    email: "audit.tenant.b@audit360.test",
    password: "TenantB#2026Valet!",
    name: "Tenant B Admin",
  });
  console.log("tenantB:", JSON.stringify(b));

  const a = await pool.query('SELECT id, name FROM organizations WHERE name = $$Audit Tenant A$$');
  const orgA = a.rows[0];
  await pool.query("UPDATE properties SET organization_id = $1 WHERE id = 1", [orgA.id]);
  const p = await pool.query("SELECT id, name, organization_id FROM properties WHERE id = 1");
  console.log("property:", JSON.stringify(p.rows[0]));
  const d = await pool.query("SELECT id, valet_id, organization_id FROM drivers WHERE id = 1");
  console.log("driver:", JSON.stringify(d.rows[0]));
  await pool.end();
})();