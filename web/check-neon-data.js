const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });
c.connect().then(() => c.query("SELECT count(*) as cnt FROM platform_settings"))
  .then(r => { console.log('platform_settings rows:', r.rows[0].cnt); return c.query("SELECT count(*) FROM users"); })
  .then(r => { console.log('users rows:', r.rows[0].count); return c.query("SELECT count(*) FROM _prisma_migrations"); })
  .then(r => { console.log('_prisma_migrations rows:', r.rows[0].count); return c.query("SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5"); })
  .then(r => { r.rows.forEach(t => console.log(JSON.stringify(t))); return c.end(); })
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
