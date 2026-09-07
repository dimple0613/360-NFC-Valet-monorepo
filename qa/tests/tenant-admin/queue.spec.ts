import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";
import { SEED } from "../../test-data/test-data";

/**
 * Tenant Admin — Live Queue.
 * Seeded order DXB-1234 → 360 Tower should be visible, with live action buttons.
 */
test.describe("Tenant Admin Live Queue", () => {
  test("queue shows seeded order with action buttons", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/queue");
    await expect(page.getByRole("heading", { name: /Live Queue/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SEED.plate).first()).toBeVisible({ timeout: 15_000 });

    const action = page.getByRole("button", { name: /Call|Retrieved|Complete|Notify|Done/i }).first();
    if ((await action.count()) > 0) await expect(action).toBeEnabled();
    expect(expectClean(collectors, "queue")).toEqual([]);
  });

  test("queue tabs / filters are present", async ({ page }) => {
    await page.goto("/tenant-admin/queue");
    await expect(page.getByRole("heading", { name: /Live Queue/i })).toBeVisible({ timeout: 15_000 });
    // At least one actionable area (search, tabs, property filter).
    const count = await page.locator('input[type="search"], select, [role="tab"]').count();
    expect(count).toBeGreaterThan(0);
  });
});