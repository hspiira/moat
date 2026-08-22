import { expect, test } from "@playwright/test";

import { ACCOUNTS } from "./fixtures/ledger";
import { expectLedgerIntact, openSeededApp, readTransactions } from "./harness";

test("money received can carry the charge taken off it", async ({ page }) => {
  await openSeededApp(page, "/transactions/capture?capture=income&type=income");
  const before = await readTransactions(page);

  await page.locator("#tx-amount").fill("500000");

  // The fee lives behind the details disclosure, and its label names what is in
  // there, so this also checks income is offered a fee at all.
  const details = page.getByRole("button", { name: /Add details/ });
  await expect(details).toContainText("fee");
  await details.click();
  await expect(page.locator("#tx-fee")).toBeVisible();
  await page.locator("#tx-fee").fill("2500");
  await page.locator("#tx-account").click();
  await page.getByRole("option", { name: "Momo Wallet" }).click();
  await page.getByRole("button", { name: /^Add transaction$/ }).click();
  await page.waitForTimeout(2500);

  const after = await expectLedgerIntact(page);
  const added = after.filter((row) => !before.some((earlier) => earlier.id === row.id));

  expect(added, "an income fee did not write its own row").toHaveLength(2);

  const income = added.find((row) => row.type === "income");
  const fee = added.find((row) => row.type === "expense");

  // The gross is kept whole and the charge stands on its own, so what arrived
  // and what it cost can both be read back.
  expect(income?.amount).toBe(500_000);
  expect(fee?.amount).toBe(2_500);
  expect(fee?.feeParentId).toBe(income?.id);
  expect(fee?.accountId).toBe(ACCOUNTS.momo.id);
  expect(income?.accountId).toBe(ACCOUNTS.momo.id);
});
