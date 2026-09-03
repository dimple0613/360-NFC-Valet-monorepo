import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/client";
import { tenantScopingExtension } from "./tenant-scoping";

// Vercel/Lambda-only fallback: Prisma's own runtime search for the query
// engine binary tries a fixed set of guessed root/subpath combinations
// (confirmed via a real production PrismaClientInitializationError listing
// its search paths) that don't include this project's actual monorepo
// layout — packages/db/generated/client relative to the Lambda's actual
// working directory. Rather than guess which of Prisma's own guesses might
// eventually match, point it at the real file directly if we can find it;
// this only ever runs on Linux (the deployed target), so local dev (Windows,
// where Prisma's default search already works fine) is untouched.
if (process.platform === "linux" && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engineFilename = "libquery_engine-rhel-openssl-3.0.x.so.node";
  const candidateDirs = [
    path.join(process.cwd(), "packages/db/generated/client"),
    path.join(process.cwd(), "../packages/db/generated/client"),
    path.join(__dirname, "../generated/client"),
  ];
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, engineFilename);
    if (existsSync(candidate)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
      break;
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * The raw, unscoped client. Reserved for the Super Admin portal, migrations, and
 * seed/maintenance scripts that must legitimately operate across organizations.
 * Do not import this into tenant-facing request/job handling.
 *
 * This also bypasses AuditLog's immutability guard (tenant-scoping.ts only wraps
 * `db`, not this client) — nothing stops `prismaWithoutTenantScoping.auditLog.update(...)`
 * at the application layer. Enforcing that at the DB level too (e.g. revoking
 * UPDATE/DELETE on audit_logs from the app role) is real hardening worth doing before
 * production, not done here — treat this export as trusted-code-only in the meantime.
 */
export const prismaWithoutTenantScoping = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prismaWithoutTenantScoping;
}

/**
 * The tenant-scoped client. Application code should import and use this, not
 * `prismaWithoutTenantScoping` — see tenant-scoping.ts for what it enforces and
 * tenant-context.ts for how the active tenant gets in and out of scope.
 */
export const db = prismaWithoutTenantScoping.$extends(tenantScopingExtension);
