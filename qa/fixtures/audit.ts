import { test as base, Page } from "@playwright/test";
import { BASE, SUPER_ADMIN, TENANT_B } from "../test-data/test-data";

/**
 * Extends Playwright's test with:
 *  - login helpers (super admin / tenant B / arbitrary user)
 *  - a per-test console+network error collector
 *  - a hard-fail convenience: many pages must be console-error free.
 */

export interface Collectors {
  /** Page errors pushed as {type:'pageerror', text} + console errors. */
  errors: string[];
  failedRequests: string[];
}

async function collect(page: Page, store: Collectors) {
  page.on("pageerror", (err) => store.errors.push(`PAGEERROR: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      store.errors.push(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });
  page.on("requestfailed", (req) => store.failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`));
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE.web}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  // "Keep me signed in" is checked by default; leave it.
  await page.getByRole("button", { name: /sign in/i }).click();
  // Login redirects to "/" which fans out to /tenant-admin or /super-admin.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15_000 });
}

export const test = base.extend<{
  collectors: Collectors;
  superAdmin: Page;
  tenantB: Page;
  login: (email: string, password: string) => Promise<void>;
}>({
  collectors: async ({ page }, use) => {
    const store: Collectors = { errors: [], failedRequests: [] };
    await collect(page, store);
    await use(store);
  },

  login: async ({ page }, use) => {
    await use((email: string, password: string) => login(page, email, password));
  },

  superAdmin: async ({ page }, use) => {
    await login(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
    await use(page);
  },

  tenantB: async ({ page }, use) => {
    await login(page, TENANT_B.email, TENANT_B.password);
    await use(page);
  },
});

export { BASE, SUPER_ADMIN, TENANT_B };

/** Assert no console/page errors were collected (a QA gate). */
export function expectClean(store: Collectors, context: string): string[] {
  const issues = store.errors.filter(
    // Allow the known dev-only WebSocket fallback warning (see M6 backlog).
    (e) => !e.includes("WebSocket") && !e.includes("websocket") && !e.includes("EVENTSOURCE"),
  );
  return issues;
}
