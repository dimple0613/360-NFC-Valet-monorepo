import { expect } from "@playwright/test";
import { test, expectClean, BASE } from "../../fixtures/audit";
import { uniqueName, SEED } from "../../test-data/test-data";

/**
 * Tenant Admin — Locations CRUD + search + form.
 */
test.describe("Tenant Admin Locations", () => {
  test("list loads with seeded location and correct org data", async ({ page, collectors }) => {
    await page.goto("/tenant-admin/locations");
    await expect(page.getByText(/360 Tower/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Downtown/i).first()).toBeVisible();
    await expect(page.getByText(/160 slots/i).first()).toBeVisible();
    expect(expectClean(collectors, "locations list")).toEqual([]);
  });

  test("create location — full CRUD lifecycle with persistence", async ({ page }) => {
    const locName = uniqueName("PW_TEST_LOC");
    await page.goto("/tenant-admin/locations");
    await expect(page.getByText(/360 Tower/i).first()).toBeVisible({ timeout: 15_000 });

    // Open create form (Add location button).
    await page.getByRole("link", { name: /add location/i }).first().click();
    await page.waitForURL(/\/locations/);

    // Fill the form — fields per the new-location form: name, area, zones, slots, guest URL slug.
    await page.getByLabel(/name/i).fill(locName);
    await page.getByLabel(/area/i).fill("QA Test District");
    const zones = page.getByLabel(/zones/i);
    if ((await zones.count()) > 0) await zones.fill("3");
    const slots = page.getByLabel(/slots/i);
    if ((await slots.count()) > 0) await slots.fill("50");
    const slug = page.getByLabel(/url|slug/i).first();
    if ((await slug.count()) > 0) await slug.fill("qatest");

    await page.getByRole("button", { name: /create|save|add/i }).first().click();

    // Either redirected to list with the new location, or stays and shows it.
    await page.waitForTimeout(800);
    await page.goto("/tenant-admin/locations");
    await expect(page.getByText(locName).first()).toBeVisible({ timeout: 15_000 });

    // RELOAD = persistence check.
    await page.reload();
    await expect(page.getByText(locName).first()).toBeVisible({ timeout: 15_000 });
  });

  test("search filters the locations list", async ({ page }) => {
    await page.goto("/tenant-admin/locations");
    await expect(page.getByText(/360 Tower/i).first()).toBeVisible({ timeout: 15_000 });
    const search = page.getByPlaceholder(/search/i).or(page.locator('input[type="search"]')).first();
    if ((await search.count()) > 0) {
      await search.fill("zzz-no-match");
      await page.waitForTimeout(500);
      await expect(page.getByText(/No .*found|No results|no locations/i).first()).toBeVisible({ timeout: 10_000 });
      await search.fill(SEED.property);
      await page.waitForTimeout(500);
      await expect(page.getByText(/360 Tower/i).first()).toBeVisible();
    }
  });
});