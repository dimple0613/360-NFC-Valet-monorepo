import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Loads web/.env into process.env so the valet `pg` pool in
    // app/tenant-admin/_lib/db.ts (which reads DATABASE_URL directly, unlike
    // Prisma's self-loading client) can connect during tests.
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests against a live Postgres shared with the DB service
    // layer's suite — sequential to avoid tests racing each other's fixture rows in
    // global (non-tenant-scoped) tables like Permission.
    fileParallelism: false,
  },
});
