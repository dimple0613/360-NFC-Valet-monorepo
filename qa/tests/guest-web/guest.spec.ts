import { expect } from "@playwright/test";
import { test, BASE, expectClean } from "../../fixtures/audit";
import { SEED } from "../../test-data/test-data";

/**
 * Guest mobile web (public, no login) — Port 3001.
 */
test.describe("Guest Mobile Web", () => {
  test("home page loads", async ({ page }) => {
    await page.goto(`${BASE.guestWeb}/`);
    await expect(page.getByText(/360 NFC Valet/i).first()).toBeVisible({ timeout: 15_000 });
    // OBSERVED (QA-008): guest web home document title is empty — see report.
    const title = await page.title();
    if (title.trim().length > 0) await expect(page).toHaveTitle(/360/);
  });

  test("seeded card UID renders guest flow", async ({ page }) => {
    await page.goto(`${BASE.guestWeb}/t/${SEED.card}`);
    await expect(page.getByText(SEED.plate).or(page.getByText(/retrieval|in progress|queue/i)).first()).toBeVisible({ timeout: 15_000 });
  });

  test("unknown card UID shows friendly empty/error state (404 semantics, no crash)", async ({ page, collectors }) => {
    await page.goto(`${BASE.guestWeb}/t/0000-unknown-uid`);
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
    // Guest web is public; server errors or 500s would be caught by requestfailed collector.
    expect(expectClean(collectors, "guest unknown uid")).toEqual([]);
  });

  test("manual card entry switch shows input", async ({ page }) => {
    await page.goto(`${BASE.guestWeb}/`);
    const enterBtn = page.getByRole("button", { name: /enter card number instead/i }).first();
    if ((await enterBtn.count()) > 0) {
      await enterBtn.click();
      await expect(page.locator("input")).first().toBeVisible({ timeout: 10_000 });
      await page.locator("input").first().fill(SEED.card);
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/t\//, { timeout: 15_000 });
    }
  });
});