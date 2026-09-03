import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// web/ has no .env of its own — it consumes @saasclaude/db's services directly
// (Server Actions/Components calling into packages/db), which need DATABASE_URL,
// ENCRYPTION_KEY, SUPER_ADMIN_EMAIL, etc. at runtime. Rather than duplicating
// those values into a second .env file (drift risk), load the one source of
// truth directly. next.config.ts runs in the same Node process that boots the
// dev/prod server, so this mutates process.env for the whole server lifetime —
// every route handler/Server Component sees it. Existing process.env values
// (e.g. real secrets injected by a host platform) still win, since dotenv
// doesn't override already-set variables.
config({ path: path.resolve(__dirname, "../packages/db/.env") });
// The merged 360 NFC Valet console reads its own valet-specific env vars
// (JWT_SECRET, SMTP/WS/NEXT_PUBLIC_*) from web/.env.
config({ path: path.resolve(__dirname, "./.env") });

const nextConfig: NextConfig = {
  // Enables forbidden()/unauthorized() (used to gate the Super Admin and
  // Tenant Admin portals on platform/tenant permissions).
  experimental: {
    authInterrupts: true,
  },
  // Monorepo + custom Prisma `output` + Vercel gotcha (confirmed via a real
  // production PrismaClientInitializationError, "could not locate the Query
  // Engine for runtime rhel-openssl-3.0.x"): our code imports the generated
  // client from a relative path (packages/db/generated/client), never the
  // literal "@prisma/client" specifier, so marking that package external
  // did nothing useful here — removed. outputFileTracingRoot widens Next's
  // default (this directory) tracing root so files under packages/db are
  // visible to it at all — confirmed via the emitted .nft.json, which does
  // list the engine binary with this in place. The runtime PrismaClient
  // still couldn't find it by its own guessed search paths even so, fixed
  // separately in packages/db/src/client.ts with an explicit
  // PRISMA_QUERY_ENGINE_LIBRARY override on Linux.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/*": ["../packages/db/generated/client/**/*"],
  },
};

export default nextConfig;
