import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";
import { SEED, uniqueName } from "../../test-data/test-data";
import { expectDialogHasNoDoubleScroll } from "../../utils/helpers";

/**
 * Tenant Admin — Offers list + create (form lifecycle).
 */
test.describe("Tenant Admin Offers", () => {
  test("offers list loads with seeded offer", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(SEED.offer).first()).toBeVisible({ timeout: 15_000 });
    expect(expectClean(collectors, "offers list")).toEqual([]);
  });

  test("create offer via modal form persists across reload", async ({ page }) => {
    const title = uniqueName("PW_TEST_OFFER");
    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(SEED.offer).first()).toBeVisible({ timeout: 15_000 });

    const addNew = page.getByRole("button", { name: /add offer|new offer|create/i }).first();
    await addNew.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel(/^title/i).fill(title);

    const save = dialog.getByRole("button", { name: /save|create|add/i }).first();
    await save.click();
    await page.waitForTimeout(1000);

    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  });

  test("cancel offer from list", async ({ page }) => {
    const title = uniqueName("PW_TEST_OFFER_CANCEL");
    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(SEED.offer).first()).toBeVisible({ timeout: 15_000 });

    const addNew = page.getByRole("button", { name: /add offer|new offer|create/i }).first();
    await addNew.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel(/^title/i).fill(title);
    await dialog.getByRole("button", { name: /save|create|add/i }).first().click();
    await page.waitForTimeout(1000);
    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

    // Cancel (status toggle) the row.
    const row = page.locator("tr").filter({ hasText: title }).first();
    const cancelBtn = row.getByRole("button", { name: /cancel|deactivate|disable|pause/i }).first();
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await expect(page.getByText(/offer cancelled|cancelled|cancel successfully/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // Pinned regression for GitHub #20 (double-scroll in the New offer modal).
  // Currently EXPECTED TO FAIL until #20 is fixed — do not skip; it documents the
  // bug with a measurable assertion and turns green automatically once fixed.
  test("new offer modal has a single scroll container (no double-scroll)", async ({ page }) => {
    await page.goto("/tenant-admin/offers");
    await expect(page.getByText(SEED.offer).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /add offer|new offer|create/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 10_000 });

    await expectDialogHasNoDoubleScroll(page);
  });
});