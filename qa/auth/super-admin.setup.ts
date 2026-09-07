import { expect } from "@playwright/test";
import { test, BASE, SUPER_ADMIN } from "../fixtures/audit";

/**
 * Saves the super admin's cookie session to auth/super-admin.json.
 * Runs once (setup project) ahead of the main suite so module tests don't log in.
 */
test("save super-admin auth state", async ({ page }) => {
  await page.goto(`${BASE.web}/login`);
  await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
  await page.locator('input[name="password"]').fill(SUPER_ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/tenant-admin/);
  await page.context().storageState({ path: "auth/super-admin.json" });
});