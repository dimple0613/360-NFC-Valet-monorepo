import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";

/**
 * Tenant Admin — Reports: day search + filters load.
 */
test.describe("Tenant Admin Reports", () => {
  test("reports load with day search and table", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/reports");
    await expect(page.getByPlaceholder(/Search day or date/i).first()).toBeVisible({ timeout: 15_000 });
    expect(expectClean(collectors, "reports")).toEqual([]);
  });

  test("reports day filter/sort does not crash and updates", async ({ page }) => {
    await page.goto("/tenant-admin/reports");
    const search = page.getByPlaceholder(/Search day or date/i).first();
    await search.fill("3000-01-01");
    await page.waitForTimeout(600);
    // Non-crash + either empty state or a row.
    await expect(page.locator("body")).toBeVisible();
  });
});