import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";
import { SEED } from "../../test-data/test-data";

/**
 * Tenant Admin — NFC Cards list, search, add.
 */
test.describe("Tenant Admin NFC Cards", () => {
  test("list loads with seeded card and card search works", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/cards");
    await expect(page.getByText(SEED.card).first()).toBeVisible({ timeout: 15_000 });
    const search = page.getByPlaceholder(/Search card UID/i).first();
    if ((await search.count()) > 0) {
      await search.fill("zzz-nope");
      await page.waitForTimeout(600);
      await expect(page.getByText(SEED.card)).toHaveCount(0);
      await search.fill(SEED.card);
      await page.waitForTimeout(600);
      await expect(page.getByText(SEED.card).first()).toBeVisible();
    }
    expect(expectClean(collectors, "cards list")).toEqual([]);
  });

  test("card detail page opens via Manage and shows history", async ({ page }) => {
    await page.goto("/tenant-admin/cards");
    const manage = page.getByRole("button", { name: `Manage ${SEED.card}` }).first();
    await expect(manage).toBeVisible({ timeout: 15_000 });
    await manage.click();
    await page.waitForURL(/\/cards\//, { timeout: 15_000 });
    await expect(page.getByText(/history|past orders/i).first()).toBeVisible({ timeout: 15_000 });
  });
});