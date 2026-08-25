import { expect, test } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { openSeededApp } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

test("nothing planned shows no total to speak of", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await expect(page.getByText("This trip will cost about")).toHaveCount(0);
  await expect(page.getByText("this page remembers what it cost you last time")).toBeVisible();
});

test("an item with no price still counts towards the trip", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.locator("#planner-name").fill("Rice");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("This trip will cost about")).toBeVisible();
  await expect(page.getByText("1 item has no price yet")).toBeVisible();
});

test("a price you set is named as yours, not a guess", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.locator("#planner-name").fill("Cooking oil");
  await page.getByRole("button", { name: /quantity, price and date/i }).click();
  await page.locator("#planner-estimate").fill("12000");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("All from prices you set.")).toBeVisible();
  // The headline figure, not the row's own copy of it.
  await expect(page.locator("[data-slot='money']").first()).toContainText("12,000");
});

test("what you paid before prices the trip without you typing it", async ({ page }) => {
  const fixture = buildLedgerFixture();
  const bought = fixture.transactions[0];

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    items: [
      {
        id: "item:rice",
        userId: USER_ID,
        name: "Rice",
        normalizedName: "rice",
        isArchived: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    transactionLineItems: [
      {
        id: "line:rice",
        userId: USER_ID,
        transactionId: bought.id,
        itemId: "item:rice",
        label: "Rice",
        quantity: 1,
        unitPrice: 8_000,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  });
  await page.goto("/shopping");
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.locator("#planner-name").fill("Rice");

  // The form says what it remembers before you decide to override it.
  await expect(page.getByText(/Leave the price out to use that/i)).toBeVisible();

  await page.getByRole("button", { name: /quantity, price and date/i }).click();
  await page.locator("#planner-quantity").fill("2");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(1500);

  // Two at 8,000, none of it typed by hand.
  await expect(page.locator("[data-slot='money']").first()).toContainText("16,000");
  await expect(page.getByText("of it from what you last paid")).toBeVisible();
});
