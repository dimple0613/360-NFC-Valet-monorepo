const { Client } = require('pg');

async function main() {
  const local = new Client({ connectionString: 'postgresql://valet:valet_dev@localhost:5432/valet_monorepo?schema=public' });
  const neon = new Client({ connectionString: 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });

  await local.connect();
  await neon.connect();
  console.log('Connected');

  // Seed currencies
  try {
    const r = await local.query('SELECT * FROM currencies');
    for (const row of r.rows) {
      await neon.query('INSERT INTO currencies (id, code, name, symbol, "isDefault", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [row.id, row.code, row.name, row.symbol, row.isDefault, row.createdAt, row.updatedAt]);
    }
    console.log(`currencies: ${r.rows.length}`);
  } catch(e) { console.log('currencies:', e.message.substring(0,60)); }

  // Seed features
  try {
    const r = await local.query('SELECT * FROM features');
    for (const row of r.rows) {
      await neon.query('INSERT INTO features (id, key, name, description, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
        [row.id, row.key, row.name, row.description, row.createdAt, row.updatedAt]);
    }
    console.log(`features: ${r.rows.length}`);
  } catch(e) { console.log('features:', e.message.substring(0,60)); }

  // Seed resource_types
  try {
    const r = await local.query('SELECT * FROM resource_types');
    for (const row of r.rows) {
      await neon.query('INSERT INTO resource_types (id, key, name, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [row.id, row.key, row.name, row.createdAt, row.updatedAt]);
    }
    console.log(`resource_types: ${r.rows.length}`);
  } catch(e) { console.log('resource_types:', e.message.substring(0,60)); }

  // Seed notification_kinds
  try {
    const r = await local.query('SELECT * FROM notification_kinds');
    for (const row of r.rows) {
      await neon.query('INSERT INTO notification_kinds (id, key, name, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [row.id, row.key, row.name, row.createdAt, row.updatedAt]);
    }
    console.log(`notification_kinds: ${r.rows.length}`);
  } catch(e) { console.log('notification_kinds:', e.message.substring(0,60)); }

  // Seed plans
  try {
    const r = await local.query('SELECT * FROM plans');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO plans (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`plans: ${r.rows.length}`);
  } catch(e) { console.log('plans:', e.message.substring(0,80)); }

  // Seed plan_features
  try {
    const r = await local.query('SELECT * FROM plan_features');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO plan_features (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    console.log(`plan_features: ${r.rows.length}`);
  } catch(e) { console.log('plan_features:', e.message.substring(0,80)); }

  // Seed plan_resources
  try {
    const r = await local.query('SELECT * FROM plan_resources');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO plan_resources (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    console.log(`plan_resources: ${r.rows.length}`);
  } catch(e) { console.log('plan_resources:', e.message.substring(0,80)); }

  // Seed roles
  try {
    const r = await local.query('SELECT * FROM roles');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO roles (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`roles: ${r.rows.length}`);
  } catch(e) { console.log('roles:', e.message.substring(0,80)); }

  // Seed role_permissions
  try {
    const r = await local.query('SELECT * FROM role_permissions');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO role_permissions (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    console.log(`role_permissions: ${r.rows.length}`);
  } catch(e) { console.log('role_permissions:', e.message.substring(0,80)); }

  // Seed platform_role_permissions
  try {
    const r = await local.query('SELECT * FROM platform_role_permissions');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO platform_role_permissions (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    console.log(`platform_role_permissions: ${r.rows.length}`);
  } catch(e) { console.log('platform_role_permissions:', e.message.substring(0,80)); }

  // Seed platform_user_roles (skip if FK fails)
  try {
    const r = await local.query('SELECT * FROM platform_user_roles');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO platform_user_roles (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
    }
    console.log(`platform_user_roles: ${r.rows.length}`);
  } catch(e) { console.log('platform_user_roles:', e.message.substring(0,80)); }

  // Seed users
  try {
    const r = await local.query('SELECT * FROM users');
    for (const row of r.rows) {
      const cols = Object.keys(row);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');
      const vals = cols.map(c => row[c]);
      await neon.query(`INSERT INTO users (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, vals);
    }
    console.log(`users: ${r.rows.length}`);
  } catch(e) { console.log('users:', e.message.substring(0,120)); }

  // Verify
  const psCount = await neon.query('SELECT count(*) FROM platform_settings');
  const uCount = await neon.query('SELECT count(*) FROM users');
  const fCount = await neon.query('SELECT count(*) FROM features');
  const plCount = await neon.query('SELECT count(*) FROM plans');
  console.log(`\nVerification: platform_settings=${psCount.rows[0].count}, users=${uCount.rows[0].count}, features=${fCount.rows[0].count}, plans=${plCount.rows[0].count}`);

  await local.end();
  await neon.end();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
