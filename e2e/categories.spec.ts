import { expect, test, type Page } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { expectNoSidewaysScroll } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

const OWN_CATEGORY = {
  id: "e2e-category-own",
  userId: USER_ID,
  name: "Workout & Gym",
  kind: "expense" as const,
  isDefault: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

function duplicateOf(name: string, kind: "expense" | "income") {
  return {
    id: `e2e-category-duplicate-${name.toLowerCase()}`,
    userId: USER_ID,
    name,
    kind,
    isDefault: true,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

async function openCategories(page: Page, options: { ownTransactions?: number } = {}) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  const fixture = buildLedgerFixture();
  const own = options.ownTransactions ?? 0;
  let refiled = 0;

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    categories: [
      ...fixture.categories,
      OWN_CATEGORY,
      duplicateOf("Food", "expense"),
      duplicateOf("Salary", "income"),
    ],
    transactions: fixture.transactions.map((row) =>
      row.type === "expense" && refiled++ < own ? { ...row, categoryId: OWN_CATEGORY.id } : row,
    ),
  });
  await page.goto("/settings/categories");
  await page.waitForTimeout(1500);

  return { errors };
}

test("duplicate names fold into the copy already in use", async ({ page }) => {
  const { errors } = await openCategories(page);

  await expect(page.getByText("2 duplicate categories")).toBeVisible();
  await page.getByRole("button", { name: "Merge duplicates" }).click();

  await expect(page.getByText(/Merged 2 duplicates/)).toBeVisible();
  await expect(page.getByText("2 duplicate categories")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Food/ })).toHaveCount(1);
  await expect(page.getByText("20 transactions · last 17 Aug")).toBeVisible();

  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("moving a category empties it and clears it away", async ({ page }) => {
  await openCategories(page, { ownTransactions: 3 });

  await page.getByRole("button", { name: /^Workout & Gym/ }).click();
  await page.getByLabel("Move everything into").click();
  await page.getByRole("option", { name: "Food", exact: true }).first().click();
  await page.getByRole("button", { name: "Move into Food" }).click();
  await page.getByRole("button", { name: "Move", exact: true }).click();

  await expect(page.getByText(/Moved 3 transactions into Food/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Workout & Gym/ })).toHaveCount(0);
});

test("a category nothing is filed under can be deleted outright", async ({ page }) => {
  await openCategories(page);

  // The screen opens on the categories in use, so an unused one is a filter away.
  await page.getByRole("button", { name: /^Never used/ }).click();
  await page.getByRole("button", { name: /^Workout & Gym/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Deleted Workout & Gym.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Workout & Gym/ })).toHaveCount(0);
});

test("a category Moat ships with is hidden rather than deleted", async ({ page }) => {
  await openCategories(page);

  await page.getByRole("button", { name: /^Airtime/ }).click();

  await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(page.getByText(/comes with Moat/)).toBeVisible();
});
