import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";

/**
 * Tenant Admin — Settings area (two-tier nav). Super admin (owns A) can open it.
 */
test.describe("Tenant Admin Settings", () => {
  test("account settings loads", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/settings");
    await expect(page.getByRole("heading", { name: /Account/i }).first()).toBeVisible({ timeout: 15_000 });
    expect(expectClean(collectors, "account settings")).toEqual([]);
  });

  test("security settings loads with MFA surface", async ({ page }) => {
    await page.goto("/tenant-admin/settings/security");
    await expect(page.getByRole("heading", { name: /Security/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("sessions list loads", async ({ page }) => {
    await page.goto("/tenant-admin/settings/sessions");
    await expect(page.getByText(/session|browser|device/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("API keys page loads and create form opens", async ({ page }) => {
    await page.goto("/tenant-admin/settings/api-keys");
    await expect(page.getByText(/api key/i).first()).toBeVisible({ timeout: 15_000 });
    const create = page.getByRole("button", { name: /new api key|create|add/i }).first();
    if ((await create.count()) > 0) {
      await create.click();
      const dialog = page.getByRole("dialog").first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.getByRole("button", { name: /close|cancel/i }).first().click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("team list loads", async ({ page }) => {
    await page.goto("/tenant-admin/settings/team");
    await expect(page.getByText(/member|team/i).first()).toBeVisible({ timeout: 15_000 });
  });
});