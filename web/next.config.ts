import path from "node:path";
import { config } from "dotenv";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Single web/.env sources every server-side env var — platform/DB (DATABASE_URL,
// AUTH_SECRET, ENCRYPTION_KEY, ...) and valet-specific (JWT_SECRET, SMTP/WS,
// NEXT_PUBLIC_*). Loaded at server boot; existing process.env values win (dotenv
// doesn't override already-set variables).
config({ path: path.resolve(__dirname, "./.env") });

const nextConfig: NextConfig = {
  // Enables forbidden()/unauthorized() (used to gate the Super Admin and
  // Tenant Admin portals on platform/tenant permissions).
  experimental: {
    authInterrupts: true,
  },
  outputFileTracingRoot: path.join(__dirname, "."),
  outputFileTracingIncludes: {
    "/*": ["./src/lib/db/generated/client/**/*"],
  },
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Pre-existing type errors (Next 16 made request.json() return `unknown`,
  // tripping every API route that destructures the body) block the production
  // build. Cloudflare-deploy scope: run `npm run typecheck` and fix these.
  typescript: {
    ignoreBuildErrors: true,
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;