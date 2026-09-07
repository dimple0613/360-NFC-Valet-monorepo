import { expect } from "@playwright/test";
import { test, BASE, SUPER_ADMIN, TENANT_B } from "../../fixtures/audit";

/**
 * 4. Authentication lifecycle.
 * (Do not reuse authenticated context here — authentication itself is the subject.)
 */

test.describe("Authentication", () => {
  test("valid login -> correct landing (super admin to tenant-admin, dual role)", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
    await page.locator('input[name="password"]').fill(SUPER_ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    // Super admin owns org A so lands on tenant-admin; still holds platform role.
    await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
    await expect(page).toHaveTitle(/360 Valet/);
  });

  test("invalid password shows a useful error and stays on login", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i).or(page.getByText(/credentials/i))).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("invalid email format is rejected client-side", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('input[name="password"]').fill("whatever");
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("empty email / password shows validation", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/work email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("password visibility toggle reveals the value", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    const pw = page.locator('input[name="password"]');
    await pw.fill("Secret123");
    expect(await pw.getAttribute("type")).toBe("password");
    await page.getByRole("button", { name: /toggle password visibility/i }).click();
    expect(await pw.getAttribute("type")).toBe("text");
    expect(await pw.inputValue()).toBe("Secret123");
    await page.getByRole("button", { name: /toggle password visibility/i }).click();
    expect(await pw.getAttribute("type")).toBe("password");
  });

  test("'Keep me signed in' checkbox toggles", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    const box = page.getByRole("button", { name: /keep me signed in/i });
    await expect(box.locator(".checkbox-box")).toHaveClass(/checked/);
    await box.click();
    await expect(box.locator(".checkbox-box")).not.toHaveClass(/checked/);
    await box.click();
    await expect(box.locator(".checkbox-box")).toHaveClass(/checked/);
  });

  test("login via Enter key submits", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill(TENANT_B.email);
    await page.locator('input[name="password"]').fill(TENANT_B.password);
    await page.locator('input[name="password"]').press("Enter");
    await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
  });

  test("session persists across a full refresh after login", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
    await page.locator('input[name="password"]').fill(SUPER_ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
    await page.reload();
    await expect(page).toHaveURL(/\/tenant-admin/);
  });

  test("forgot-password page loads", async ({ page }) => {
    await page.goto(`${BASE.web}/forgot-password`);
    await expect(page.getByRole("heading", { name: /forgot/i }).or(page.getByText(/reset.*password/i).first())).toBeVisible();
  });

  // OBSERVED BEHAVIOR (documented, Low): an authenticated user can still open
  // /login (it shows the form rather than redirecting to the dashboard). The
  // home "/" DOES redirect authenticated users; /login itself has no guard.
  // Recorded as finding QA-007 in the QA report — may be intentional to allow
  // switching accounts. Test asserts the CURRENT behavior explicitly.
  test("authenticated user opening /login sees the login form (documented behavior QA-007)", async ({ page }) => {
    await page.goto(`${BASE.web}/login`);
    await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
    await page.locator('input[name="password"]').fill(SUPER_ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/tenant-admin", { timeout: 15_000 });
    await page.goto(`${BASE.web}/login`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});
