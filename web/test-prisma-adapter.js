const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./src/lib/db/generated/client');

const neonUrl = 'postgresql://neondb_owner:npg_ph0mwaE3yYbs@ep-floral-leaf-ayx4o7n3-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function test() {
  const adapter = new PrismaPg({ connectionString: neonUrl });
  const client = new PrismaClient({ adapter });
  try {
    const count = await client.platformSetting.count();
    console.log('platformSettings count:', count);
    console.log('SUCCESS');
  } catch (e) {
    console.error('FAILED:', e.message);
    console.error('Code:', e.code);
  } finally {
    await client.$disconnect();
  }
}
test();
