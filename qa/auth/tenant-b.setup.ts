import { expect } from "@playwright/test";
import { test, BASE, TENANT_B } from "../fixtures/audit";

/**
 * Saves Tenant B's cookie session to auth/tenant-b.json.
 */
test("save tenant-b auth state", async ({ page }) => {
  await page.goto(`${BASE.web}/login`);
  await page.locator('input[name="email"]').fill(TENANT_B.email);
  await page.locator('input[name="password"]').fill(TENANT_B.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/tenant-admin/);
  await page.context().storageState({ path: "auth/tenant-b.json" });
});