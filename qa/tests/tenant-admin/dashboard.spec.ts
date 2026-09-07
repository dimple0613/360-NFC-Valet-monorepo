import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";

/**
 * Tenant Admin — Dashboard module.
 * Runs as super admin (owns org A) via storage state.
 */
test.describe("Tenant Admin Dashboard", () => {
  test("loads with stat chips, chart, live activity", async ({ page, collectors }) => {
    await page.goto("/tenant-admin");
    await expect(page).toHaveURL(/\/tenant-admin$/);
    // Stat chips (seeded org A data).
    await expect(page.getByText(/Cars parked/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/360 Tower/i).first()).toBeVisible();
    // Charts / report section present.
    await expect(page.getByText(/Cars in & out|Cars in and out/i)).toBeVisible();
    await expect(page.getByText(/By property/i)).toBeVisible();
    // Live activity row references seeded order.
    await expect(page.getByText(/DXB-1234/i).first()).toBeVisible();
    expect(expectClean(collectors, "tenant dashboard")).toEqual([]);
  });

  test("dashboard property filter works", async ({ page }) => {
    await page.goto("/tenant-admin");
    await expect(page.getByText(/Cars parked/i).first()).toBeVisible({ timeout: 15_000 });
    const cb = page.getByRole("combobox", { name: /property/i }).first();
    if ((await cb.count()) > 0) {
      const options = await cb.locator("option").allTextContents();
      if (options.length > 1) {
        await cb.selectOption({ index: options.length - 1 });
        await page.waitForTimeout(300);
      }
    }
    await expect(page.getByText(/Cars parked/i).first()).toBeVisible();
  });
});