import { expect, test } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import {
  SHOPPING_ITEMS,
  SHOPPING_LINE_ITEMS,
  SHOPPING_PURCHASES,
  SHOPPING_TRANSACTIONS,
} from "./fixtures/shopping";
import { expectNoSidewaysScroll } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

/* The layout guards elsewhere open shopping empty, so nothing covered the page
   once it has rows. A row that would not shrink pushed the whole page sideways
   and no test noticed. */
async function openStockedShoppingList(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  const base = buildLedgerFixture() as Record<string, unknown>;
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...base,
    transactions: [...(base.transactions as unknown[]), ...SHOPPING_TRANSACTIONS],
    items: SHOPPING_ITEMS,
    plannedPurchases: SHOPPING_PURCHASES,
    transactionLineItems: SHOPPING_LINE_ITEMS,
  });
  await page.goto("/shopping");
  await page.waitForTimeout(1500);

  return { errors };
}

test("a stocked shopping list does not push the page sideways", async ({ page }) => {
  const { errors } = await openStockedShoppingList(page);

  await expect(page.getByText("Sugar").first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("every planned row keeps its amount on screen", async ({ page }) => {
  await openStockedShoppingList(page);

  const width = page.viewportSize()?.width ?? 390;
  const overflowing = await page.evaluate((limit) => {
    const out: string[] = [];
    for (const row of document.querySelectorAll("li")) {
      const box = row.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.right > limit + 1) out.push(`${row.textContent?.slice(0, 30)} @${Math.round(box.right)}`);
    }
    return out;
  }, width);

  expect(overflowing).toEqual([]);
});

test("groups what is overdue apart from what is upcoming", async ({ page }) => {
  await openStockedShoppingList(page);

  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
});

test("folds price trends away rather than spending the top of the page on them", async ({
  page,
}) => {
  await openStockedShoppingList(page);

  const trends = page.locator("details", { hasText: "What prices are doing" });
  await expect(trends).toBeVisible();
  // Closed until asked for, and below the list rather than above it.
  expect(await trends.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);

  const addButton = await page.getByRole("button", { name: "Add an item" }).boundingBox();
  const trendsBox = await trends.boundingBox();
  expect(trendsBox!.y).toBeGreaterThan(addButton!.y);
});

test("something part paid stays on the list, and what is bought is crossed out", async ({
  page,
}) => {
  await openStockedShoppingList(page);

  // The sofa is 200,000 into an agreed 500,000, so it is not bought yet.
  const sofa = page.locator("li", { hasText: "Sofa set" }).first();
  await expect(sofa).toBeVisible();
  await expect(sofa).toContainText("to go");

  // What is genuinely bought shows in its own section rather than a dropdown.
  await expect(page.getByText("Bought", { exact: true })).toBeVisible();
  const boughtRow = page.locator("li", { hasText: "Sugar" }).filter({ hasText: "Jun" }).first();
  const decoration = await boughtRow
    .locator("span.line-through")
    .first()
    .evaluate((node) => getComputedStyle(node).textDecorationLine);

  expect(decoration).toContain("line-through");
});
