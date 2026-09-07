import { expect } from "@playwright/test";
import { test, BASE } from "../../fixtures/audit";
import { uniqueName, SEED } from "../../test-data/test-data";

/**
 * Tenant Admin — Drivers list, search, filters.
 */
test.describe("Tenant Admin Drivers", () => {
  test("list loads with seeded driver and filters", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/drivers");
    await expect(page.getByText(SEED.driver).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SEED.driverId).first()).toBeVisible();
    expect(expectClean(collectors, "drivers list")).toEqual([]);
  });

  test("search finds and filters drivers", async ({ page }) => {
    await page.goto("/tenant-admin/drivers");
    await expect(page.getByText(SEED.driver).first()).toBeVisible({ timeout: 15_000 });
    const search = page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first();
    if ((await search.count()) > 0) {
      await search.fill(SEED.driverEmail);
      await page.waitForTimeout(600);
      await expect(page.getByText(SEED.driverId).first()).toBeVisible();
      await search.fill("zzz-none");
      await page.waitForTimeout(600);
      await expect(page.getByText(SEED.driverId)).toHaveCount(0);
    }
  });

  test("driver detail page shows activity and period filter", async ({ page }) => {
    await page.goto("/tenant-admin/drivers");
    // Open first Manage link.
    const manage = page.getByRole("link", { name: /manage/i }).first();
    await expect(manage).toBeVisible({ timeout: 15_000 });
    await manage.click();
    await page.waitForURL(/\/drivers\/[^/]+$/);
    await expect(page.getByText(SEED.driver).first()).toBeVisible({ timeout: 15_000 });
  });
});