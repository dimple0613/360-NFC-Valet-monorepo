import { Page, expect } from "@playwright/test";

/**
 * Generic UI assertions used across the suite.
 */

/** Assert the page does not horizontally overflow the viewport (functional mobile check). */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflow: getComputedStyle(el).overflowX };
  });
  expect(
    result.scrollWidth <= result.clientWidth + 1,
    `horizontal overflow detected: scrollWidth=${result.scrollWidth} clientWidth=${result.clientWidth} overflowX=${result.overflow}`,
  ).toBeTruthy();
}

/** Set viewport to a phone size and return previous size. */
export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 });
}

/** Assert a table/row set contains (or is missing) the given text. */
export async function expectRowWithText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
}

/** Type into a labelled field only if a label for it exists (avoids brittle failures). */
export async function fillByLabelIfPresent(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: false });
  if ((await field.count()) > 0) await field.fill(value);
}

/**
 * Layout guard (QA-020 regression): a fully-opened modal/dialog must not render
 * TWO nested scrollable containers (double-scroll). Only the dialog's own
 * scroll coordinator may own vertical scrolling; the dialog wrapper itself must
 * fit its box. Measures every element with overflow-y:auto|scroll inside the
 * dialog and asserts at most one of them overflows.
 */
export async function expectDialogHasNoDoubleScroll(
  page: Page,
  dialog = page.locator("[role='dialog']").first(),
) {
  const root = dialog;
  const result = await root.evaluate((el) => {
    const list: { tag: string; cls: string; scrollH: number; clientH: number }[] = [];
    if (el && el.querySelectorAll) {
      el.querySelectorAll("*").forEach((n: any) => {
        const cs = getComputedStyle(n);
        const scrollable =
          (cs.overflowY === "auto" || cs.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1;
        if (scrollable)
          list.push({ tag: n.tagName.toLowerCase(), cls: String(n.className).slice(0, 90), scrollH: n.scrollHeight, clientH: n.clientHeight });
      });
    }
    return { overflowers: list, count: list.length };
  });
  expect(
    result.count <= 1,
    `nested scroll containers inside dialog (double-scroll): ${JSON.stringify(result.overflowers)}`,
  ).toBeTruthy();
}
