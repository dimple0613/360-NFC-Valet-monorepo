import { expect } from "@playwright/test";
import { test, BASE } from "../../fixtures/audit";

/**
 * 5. Role & permission testing — UI visibility + direct URL access control.
 *
 * Super admin (org A owner + platform) may reach BOTH portals.
 * Tenant B admin must NOT reach super-admin routes and vice-versa.
 * Unauthenticated users must be redirected to login.
 */

test.describe("Roles and Permissions", () => {
  test.describe("direct URL access", () => {
    test("unauthenticated /super-admin redirects to login", async ({ page }) => {
      await page.goto(`${BASE.web}/super-admin`);
      await page.waitForURL(/\/(login|signup)/, { timeout: 15_000 });
    });

    test("unauthenticated /tenant-admin redirects to login", async ({ page }) => {
      await page.goto(`${BASE.web}/tenant-admin`);
      await page.waitForURL(/\/(login|signup)/, { timeout: 15_000 });
    });

    test("super admin can open /super-admin directly", async ({ superAdmin }) => {
      await superAdmin.goto(`${BASE.web}/super-admin`);
      await expect(superAdmin).toHaveTitle(/Super Admin/);
      await expect(superAdmin.getByRole("heading", { name: /super admin/i }).first()).toBeVisible();
    });

    test("super admin can open /tenant-admin directly (owns org A)", async ({ superAdmin }) => {
      await superAdmin.goto(`${BASE.web}/tenant-admin`);
      await expect(superAdmin.getByTitle(/dashboard/i).or(superAdmin.getByText(/dashboard/i).first())).toBeVisible();
    });
  });

  test.describe("UI menu visibility", () => {
    test("super admin sees Super Admin nav (platform)", async ({ superAdmin }) => {
      await superAdmin.goto(`${BASE.web}/super-admin`);
      // Platform nav links common to the super admin sidebar.
      await expect(superAdmin.getByRole("link", { name: /customers/i }).or(superAdmin.getByText(/customers/i).first())).toBeVisible();
    });
  });
});
