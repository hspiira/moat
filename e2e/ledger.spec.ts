import { expect, test } from "@playwright/test";

import { expectLedgerIntact, expectNoSidewaysScroll, openSeededApp, readTransactions } from "./harness";
import { TRANSACTIONS } from "./fixtures/ledger";

type Page = import("@playwright/test").Page;

async function openRow(page: Page, payee: string) {
  await page.getByRole("searchbox").first().fill(payee);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: new RegExp(`^Details for ${payee}`) }).first().click();
}

test("the ledger opens clean on a phone", async ({ page }) => {
  const { errors } = await openSeededApp(page);

  await expect(page.getByText("Ledger")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Details for / }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectLedgerIntact(page);
  expect(errors).toEqual([]);
});

test("editing an amount rewrites the row instead of adding one", async ({ page }) => {
  const { errors } = await openSeededApp(page);
  const before = await readTransactions(page);

  await openRow(page, "Market Stall");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator("#tx-amount").fill("4321");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForTimeout(2000);

  const after = await expectLedgerIntact(page);
  expect(after.length, "an edit changed the number of rows").toBe(before.length);
  expect(after.some((row) => Math.abs(row.amount) === 4321)).toBe(true);
  expect(errors).toEqual([]);
});

test("deleting takes the whole group and nothing else", async ({ page }) => {
  const { errors } = await openSeededApp(page);
  const before = await readTransactions(page);

  await openRow(page, "Own Transfer");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: /^Delete/ }).last().click();
  await page.waitForTimeout(2000);

  const after = await expectLedgerIntact(page);
  expect(before.length - after.length, "a transfer did not delete as a pair").toBe(2);
  expect(errors).toEqual([]);
});

test("a fee is shown against its payment, not on its own", async ({ page }) => {
  await openSeededApp(page);

  const fee = TRANSACTIONS.find((row) => row.feeParentId);
  expect(fee, "fixture has no fee row").toBeTruthy();

  await page.getByRole("searchbox").first().fill("Airtime Top Up");
  await page.waitForTimeout(1200);

  await page.locator("section > ul > li button").first().click();
  await page.waitForTimeout(900);

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Total off account")).toBeVisible();
  await expectNoSidewaysScroll(page);
});
