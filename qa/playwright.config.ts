import { defineConfig } from "@playwright/test";

/**
 * 360 NFC Valet — Full QA E2E suite.
 * Targets LIVE dev servers: web :3000 (Super Admin + Tenant Admin),
 * guest mobile web :3001. Data created uses PW_TEST_* prefixes.
 *
 * Auth strategy (per QA spec §27): log in ONCE per role in a "setup" project,
 * save the cookie session as storage state, and reuse it for the module suites.
 * The tests/auth suite intentionally does NOT use storage state — it tests
 * authentication itself and performs its own real logins.
 *
 * workers: 1 keeps us under the app's login rate limit (10/min/email) and avoids
 * cross-test mutation of the live dev DB. Chromium-only (documented limitation).
 */

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  outputDir: "test-results/artifacts",
  projects: [
    // Auth state harvest (runs first, once each).
    {
      name: "setup-super-admin",
      testDir: "./auth",
      testMatch: /super-admin\.setup\.ts/,
    },
    {
      name: "setup-tenant-b",
      testDir: "./auth",
      testMatch: /tenant-b\.setup\.ts/,
    },

    // Auth lifecycle suite — raw logins, no storage state.
    {
      name: "auth",
      testDir: "./tests/auth",
      testMatch: /auth\.spec\.ts/,
      dependencies: [],
    },

    // Role/permission suite — needs a logged-in super admin.
    {
      name: "roles",
      testDir: "./tests/roles",
      testMatch: /roles-permissions\.spec\.ts/,
      dependencies: ["setup-super-admin"],
      use: { storageState: "auth/super-admin.json" },
    },

    // Super Admin product suite (platform side).
    {
      name: "super-admin",
      testDir: "./tests/super-admin",
      dependencies: ["setup-super-admin"],
      use: { storageState: "auth/super-admin.json" },
    },

    // Tenant Admin product suite.
    {
      name: "tenant-admin",
      testDir: "./tests/tenant-admin",
      dependencies: ["setup-super-admin"],
      use: { storageState: "auth/super-admin.json" },
    },

    // Tenant B isolation suite.
    {
      name: "isolation",
      testDir: "./tests/isolation",
      dependencies: ["setup-tenant-b"],
      use: { storageState: "auth/tenant-b.json" },
    },

    // Guest mobile web (public, no auth).
    {
      name: "guest-web",
      testDir: "./tests/guest-web",
    },
  ],
});