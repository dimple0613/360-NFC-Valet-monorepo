const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://valet:valet_dev@localhost:5432/valet_monorepo?schema=public' });
c.connect().then(() => c.query("SELECT count(*) FROM platform_settings"))
  .then(r => { console.log('OK, platform_settings rows:', r.rows[0].count); return c.end(); })
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
