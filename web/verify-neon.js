const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });
c.connect().then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
  .then(r => { r.rows.forEach(t => console.log(t.table_name)); return c.end(); })
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
