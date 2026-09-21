import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

// Lending puts money into a receivable and borrowing draws it out of a debt.
// Getting that backwards is easy, and the old empty state left the reader to
// work it out from a sentence about transfers.

test("recording money lent fills in the receivable as the destination", async ({ page }) => {
  await openSeededApp(page, "/debt");

  await page.getByRole("button", { name: "Record money lent" }).click();

  const sheet = page.locator("[data-slot='sheet-content']");
  await expect(sheet.getByLabel("To account")).toContainText("Money lent out");
});

test("recording money borrowed fills in the debt as the source", async ({ page }) => {
  await openSeededApp(page, "/debt");

  await page.getByRole("button", { name: "Record money borrowed" }).click();

  const sheet = page.locator("[data-slot='sheet-content']");
  await expect(sheet.getByLabel("From account")).toContainText("Money borrowed");
});

test("planning a payoff waits behind the debts it is about", async ({ page }) => {
  await openSeededApp(page, "/debt");

  // Nothing owed, so there is nothing to plan and no disclosure either.
  await expect(page.getByText("Plan a payoff")).toHaveCount(0);
});
