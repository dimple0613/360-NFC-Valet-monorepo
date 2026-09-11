const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function run() {
  await c.connect();
  console.log('Connected to Neon DB');

  // Seed platform_settings with defaults needed by the app
  const settings = [
    ['branding.primary_color', '"#6366f1"'],
    ['branding.secondary_color', '"#8b5cf6"'],
    ['branding.logo_url', 'NULL'],
    ['branding.favicon_url', 'NULL'],
    ['branding.company_name', '"360 Valet"'],
    ['branding.tagline', '"Premium Valet Management"'],
    ['pages.login_title', '"Welcome Back"'],
    ['pages.login_subtitle', '"Sign in to your account"'],
    ['pages.signup_title', '"Create Account"'],
    ['pages.signup_subtitle', '"Get started with 360 Valet"'],
    ['pages.maintenance_title', '"Under Maintenance"'],
    ['pages.maintenance_message', '"We are performing scheduled maintenance. Please check back later."'],
    ['access.registration_enabled', 'true'],
    ['access.maintenance_mode', 'false'],
    ['security.mfa_required', 'false'],
    ['security.password_min_length', '8'],
  ];

  for (const [key, val] of settings) {
    await c.query(
      'INSERT INTO platform_settings (key, value, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (key) DO NOTHING',
      [key, val]
    );
    console.log('Inserted:', key);
  }

  // Check count
  const r = await c.query('SELECT count(*) FROM platform_settings');
  console.log('Total platform_settings:', r.rows[0].count);

  // Also seed a super admin user if none exists
  const userCount = await c.query('SELECT count(*) FROM users');
  console.log('Total users:', userCount.rows[0].count);

  await c.end();
  console.log('Done');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
