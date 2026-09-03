import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests against a live Postgres — sequential to avoid tests
    // racing each other's fixture rows in the same tables.
    fileParallelism: false,
  },
});
