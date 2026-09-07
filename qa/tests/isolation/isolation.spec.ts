import { expect } from "@playwright/test";
import { test, BASE } from "../../fixtures/audit";

/**
 * Cross-tenant isolation (Tenant B) — the core NFR.
 * Tenant B must see ZERO data from Tenant A.
 */
test.describe("Cross-Tenant Isolation (Tenant B)", () => {
  test("tenant B dashboard shows zero cars / drivers / offers (no leak from A)", async ({ page }) => {
    await page.goto("/tenant-admin");
    await expect(page).toHaveURL(/\/tenant-admin/);
    await expect(page.getByText(/Cars parked/i).first()).toBeVisible({ timeout: 15_000 });
    // Tenant A seeded data must be ABSENT.
    await expect(page.getByText(/360 Tower/i)).toHaveCount(0);
    await expect(page.getByText(/DXB-1234/i)).toHaveCount(0);
    await expect(page.getByText(/1 cars parked/i)).toHaveCount(0);
  });

  test("tenant B queue page has no orders from tenant A", async ({ page }) => {
    await page.goto("/tenant-admin/queue");
    await expect(page).toHaveURL(/\/queue/);
    await expect(page.getByText(/DXB-1234/i).or(page.getByText(/7001/i))).toHaveCount(0);
  });
});