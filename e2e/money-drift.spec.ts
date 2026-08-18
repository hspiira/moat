import { expect, test } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";
import { readTransactions } from "./harness";

test("rounds fractional shillings the moment the ledger loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const bundle = buildLedgerFixture();
  const drifted = bundle.transactions.find((row) => row.id === "e2e-tx-with-fee")!;
  drifted.amount = 22174.000000164;
  drifted.originalAmount = 22174.000000164;
  bundle.accounts[0].balance = 69056.189999836;
  bundle.accounts[0].openingBalance = 1110.19;

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, bundle);
  await page.goto("/transactions");
  await page.waitForTimeout(2500);

  const rows = await readTransactions(page);
  const fractional = rows.filter((row) => !Number.isInteger(row.amount));
  expect(fractional.map((row) => `${row.id}=${row.amount}`)).toEqual([]);

  const accounts = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("moat-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<Array<{ openingBalance: number; balance: number }>>(
      (resolve, reject) => {
        const request = db.transaction("accounts").objectStore("accounts").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return all;
  });

  for (const account of accounts) {
    expect(Number.isInteger(account.openingBalance)).toBe(true);
    expect(Number.isInteger(account.balance)).toBe(true);
  }

  expect(errors).toEqual([]);
});

test("refuses a fractional amount at the form", async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, buildLedgerFixture());
  await page.goto("/transactions");
  await page.waitForTimeout(2000);

  await page.getByRole("searchbox").first().fill("Market Stall");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Actions for Market Stall/ }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  await page.locator("#tx-amount").fill("1110.19");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText(/whole number of shillings/i).first()).toBeVisible();

  const rows = await readTransactions(page);
  expect(rows.filter((row) => !Number.isInteger(row.amount))).toEqual([]);
});
