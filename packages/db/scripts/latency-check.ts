import { prismaWithoutTenantScoping, db } from "../src/client";
import { runWithTenant } from "../src/tenant-context";

// NFR-3 sanity check: "API p95 < 300ms" and "tenant-scoped queries must always
// be indexed." No REST endpoints exist yet in Phase 1A (see TASKS.md), so this
// checks the layer that actually determines whether that NFR is achievable
// once endpoints exist: the tenant-scoped Prisma queries themselves, at a
// realistic data volume, confirmed via EXPLAIN to use the organizationId index
// rather than a sequential scan. One-off diagnostic script, not a CI gate —
// run manually with `pnpm --filter @saasclaude/db exec tsx scripts/latency-check.ts`.

const ORG_COUNT = 20;
const TEAMS_PER_ORG = 100;
const SAMPLE_QUERIES = 200;

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function main() {
  console.log(`Seeding ${ORG_COUNT} orgs x ${TEAMS_PER_ORG} teams (${ORG_COUNT * TEAMS_PER_ORG} rows)...`);
  const runId = Date.now().toString(36);
  const orgs = await Promise.all(
    Array.from({ length: ORG_COUNT }, (_, i) =>
      prismaWithoutTenantScoping.organization.create({
        data: { name: `Latency Org ${i}`, slug: `latency-org-${runId}-${i}` },
      }),
    ),
  );

  for (const org of orgs) {
    await prismaWithoutTenantScoping.team.createMany({
      data: Array.from({ length: TEAMS_PER_ORG }, (_, i) => ({
        organizationId: org.id,
        name: `Team ${i}`,
        slug: `team-${i}`,
      })),
    });
  }

  const targetOrg = orgs[0];

  console.log("\nEXPLAIN ANALYZE for a tenant-scoped findMany (raw SQL, same shape the extension issues):");
  const explain = await prismaWithoutTenantScoping.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
    `EXPLAIN ANALYZE SELECT * FROM teams WHERE "organizationId" = '${targetOrg.id}'`,
  );
  for (const row of explain) console.log("  " + row["QUERY PLAN"]);

  console.log(`\nTiming ${SAMPLE_QUERIES} tenant-scoped findMany() calls through the extended client...`);
  const timings: number[] = [];
  await runWithTenant(targetOrg.id, async () => {
    for (let i = 0; i < SAMPLE_QUERIES; i++) {
      const start = performance.now();
      await db.team.findMany();
      timings.push(performance.now() - start);
    }
  });
  timings.sort((a, b) => a - b);

  console.log(`\nResults (ms), n=${SAMPLE_QUERIES}:`);
  console.log(`  p50: ${percentile(timings, 50).toFixed(2)}`);
  console.log(`  p95: ${percentile(timings, 95).toFixed(2)}`);
  console.log(`  p99: ${percentile(timings, 99).toFixed(2)}`);
  console.log(`  max: ${timings[timings.length - 1].toFixed(2)}`);

  console.log("\nCleaning up...");
  await prismaWithoutTenantScoping.team.deleteMany({ where: { organizationId: { in: orgs.map((o) => o.id) } } });
  await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: orgs.map((o) => o.id) } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaWithoutTenantScoping.$disconnect();
  });
