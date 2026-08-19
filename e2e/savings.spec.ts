import { expect, test, type Page } from "@playwright/test";

import { seededCategoryId } from "@/lib/domain/seeded-ids";

import { ACCOUNTS, USER_ID } from "./fixtures/ledger";
import { expectLedgerIntact, openSeededApp, readTransactions } from "./harness";

const SAVINGS_CATEGORY = seededCategoryId(USER_ID, "Savings");

async function chooseSavingsCategory(page: Page) {
  await page.locator("#tx-category").click();
  await page.getByLabel("Search categories").fill("Savings");
  await page.getByRole("button", { name: "Savings", exact: true }).click();
}

test("setting money aside asks where it went", async ({ page }) => {
  const { errors } = await openSeededApp(
    page,
    "/transactions/capture?capture=expense&type=expense",
  );

  await expect(page.locator("#tx-dest")).toHaveCount(0);
  await chooseSavingsCategory(page);

  await expect(
    page.locator("#tx-dest"),
    "a savings contribution was accepted without a destination",
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a savings contribution is written as a balanced pair", async ({ page }) => {
  await openSeededApp(page, "/transactions/capture?capture=expense&type=expense");
  const before = await readTransactions(page);

  await page.locator("#tx-amount").fill("250000");
  await chooseSavingsCategory(page);
  await page.locator("#tx-account").click();
  await page.getByRole("option", { name: "Town Bank" }).click();
  await page.locator("#tx-dest").click();
  await page.getByRole("option", { name: "Savings Pot" }).click();
  await page.getByRole("button", { name: /^Add transaction$/ }).click();
  await page.waitForTimeout(2500);

  const after = await expectLedgerIntact(page);
  const added = after.filter((row) => !before.some((earlier) => earlier.id === row.id));

  expect(added, "a savings contribution did not write two legs").toHaveLength(2);
  expect(added.every((row) => row.categoryId === SAVINGS_CATEGORY)).toBe(true);
  expect(added.every((row) => row.type === "transfer")).toBe(true);
  expect(added.reduce((sum, row) => sum + row.amount, 0)).toBe(0);
  expect(added.map((row) => row.accountId).sort()).toEqual(
    [ACCOUNTS.bank.id, ACCOUNTS.savingsPot.id].sort(),
  );
  expect(new Set(added.map((row) => row.transferGroupId)).size).toBe(1);
});
