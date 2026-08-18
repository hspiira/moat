import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";
import { ACCOUNTS, TRANSACTIONS } from "./fixtures/ledger";

async function currentBalance(page: import("@playwright/test").Page, accountId: string) {
  const account = Object.values(ACCOUNTS).find((entry) => entry.id === accountId)!;
  const delta = TRANSACTIONS.filter((row) => row.accountId === accountId).reduce(
    (sum, row) => sum + (row.type === "income" || row.amount < 0 ? Math.abs(row.amount) : -Math.abs(row.amount)),
    0,
  );
  return account.openingBalance + delta;
}

test("accounts are listed by name alone", async ({ page }) => {
  const { errors } = await openSeededApp(page, "/accounts");

  await expect(page.getByRole("link", { name: /Open Pocket Cash ledger/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Banks" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mobile money" })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("account history reads newest first and loads more on scroll", async ({ page }) => {
  const { errors } = await openSeededApp(
    page,
    `/accounts/detail?id=${encodeURIComponent(ACCOUNTS.cash.id)}`,
  );

  const rows = page.locator("ul.md\\:hidden > li");
  await expect(rows.first()).toBeVisible();

  const firstPage = await rows.count();
  expect(firstPage, "the whole history rendered at once").toBeLessThanOrEqual(40);

  const balances = (await rows.locator("div.mt-0\\.5").allInnerTexts()).map((text) =>
    Number(text.replace(/[^\d]/g, "")),
  );
  expect(balances.length).toBeGreaterThan(1);
  expect(balances.at(0)!, "history is not newest-first").toBeLessThan(balances.at(-1)!);
  expect(balances.at(0), "top row is not the current balance").toBe(
    Math.abs(await currentBalance(page, ACCOUNTS.cash.id)),
  );

  await rows.last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  expect(await rows.count(), "scrolling to the end revealed nothing").toBeGreaterThan(firstPage);

  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});
