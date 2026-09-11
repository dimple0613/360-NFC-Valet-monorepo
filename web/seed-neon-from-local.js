const { Client } = require('pg');

async function main() {
  const local = new Client({ connectionString: 'postgresql://valet:valet_dev@localhost:5432/valet_monorepo?schema=public' });
  const neon = new Client({ connectionString: 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });

  await local.connect();
  await neon.connect();
  console.log('Connected to both databases');

  // Tables to seed with important data
  const tables = [
    'platform_settings',
    'platform_roles',
    'platform_role_permissions',
    'platform_user_roles',
    'roles',
    'permissions',
    'role_permissions',
    'plans',
    'plan_features',
    'plan_resources',
    'features',
    'resource_types',
    'currencies',
    'notification_kinds',
  ];

  for (const table of tables) {
    try {
      const localRes = await local.query(`SELECT * FROM "${table}"`);
      const count = localRes.rows.length;
      if (count === 0) {
        console.log(`${table}: 0 rows (skipping)`);
        continue;
      }

      // Check how many rows in neon
      const neonCount = await neon.query(`SELECT count(*) FROM "${table}"`);
      const existingCount = parseInt(neonCount.rows[0].count);

      if (existingCount >= count) {
        console.log(`${table}: ${count} local, ${existingCount} neon (already has data, skipping)`);
        continue;
      }

      // Get column names from local
      const cols = Object.keys(localRes.rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

      let inserted = 0;
      for (const row of localRes.rows) {
        const values = cols.map(c => row[c]);
        try {
          await neon.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          inserted++;
        } catch (e) {
          // Skip rows that fail (duplicates, FK violations, etc.)
        }
      }
      console.log(`${table}: ${inserted}/${count} inserted`);
    } catch (e) {
      console.log(`${table}: ERROR - ${e.message.substring(0, 80)}`);
    }
  }

  await local.end();
  await neon.end();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
