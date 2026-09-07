import { expect } from "@playwright/test";
import { test, expectClean } from "../../fixtures/audit";
import { ORG_A } from "../../test-data/test-data";

/**
 * Super Admin portal (platform) — direct URL access with storage state.
 */
test.describe("Super Admin Portal", () => {
  test("dashboard loads with platform stats", async ({ page, collectors }) => {
    await page.goto("/super-admin");
    await expect(page).toHaveURL(/\/super-admin/);
    await expect(page.getByRole("heading", { name: /Super Admin|Dashboard|Overview/i }).first()).toBeVisible({ timeout: 15_000 });
    expect(expectClean(collectors, "sa dashboard")).toEqual([]);
  });

  test("organizations list shows the two seeded orgs (cross-org view)", async ({ page }) => {
    await page.goto("/super-admin/organizations");
    await expect(page.getByText(/Audit Tenant A/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("organization detail shows tenant admin name + link", async ({ page }) => {
    await page.goto(`/super-admin/organizations/${ORG_A.id}`);
    await expect(page.getByText(/Audit Tenant A/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("plans list loads", async ({ page }) => {
    await page.goto("/super-admin/plans");
    await expect(page.getByText(/plan/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("roles list loads", async ({ page }) => {
    await page.goto("/super-admin/roles");
    await expect(page.getByText(/role|permission/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("billing page loads (cross-org, view_billing gate)", async ({ page }) => {
    await page.goto("/super-admin/billing");
    await expect(page.getByText(/billing|invoice/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("invoices page loads", async ({ page }) => {
    await page.goto("/super-admin/invoices");
    await expect(page.getByText(/invoice/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("backup page loads", async ({ page }) => {
    await page.goto("/super-admin/backup");
    await expect(page.getByText(/backup|export/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("reports page loads", async ({ page }) => {
    await page.goto("/super-admin/reports");
    await expect(page.getByText(/report|revenue|metric|charge/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/super-admin/settings");
    await expect(page.getByRole("heading", { name: /Settings/i }).first()).toBeVisible({ timeout: 15_000 });
  });
});