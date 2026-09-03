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
    // Integration tests against a live Postgres shared with @saasclaude/db's
    // suite — sequential to avoid tests racing each other's fixture rows in
    // global (non-tenant-scoped) tables like Permission. Mirrors
    // packages/db/vitest.config.mts.
    fileParallelism: false,
  },
});
