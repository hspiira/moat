import { expect, test } from "@playwright/test";

import { expectLedgerIntact, openSeededApp } from "./harness";

test("a project totals what it cost across categories", async ({ page }) => {
  const { errors } = await openSeededApp(page, "/projects");

  await page.locator("#project-name").fill("Relocation");
  await page.locator("#project-budget").fill("4000000");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("Relocation").first()).toBeVisible();
  await expect(page.getByText(/Nothing tagged to it yet/i)).toBeVisible();

  await page.goto("/transactions");
  await page.waitForTimeout(1500);
  await page.getByRole("searchbox").first().fill("Market Stall");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Details for Market Stall/ }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(500);

  // Editing a row that already has a payee opens the details section itself.
  if (!(await page.locator("#tx-project").isVisible())) {
    await page.getByRole("button", { name: /details/i }).first().click();
    await page.waitForTimeout(400);
  }
  await page.locator("#tx-project").click();
  await page.getByRole("option", { name: "Relocation" }).click();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForTimeout(2000);

  await expectLedgerIntact(page);

  await page.goto("/projects");
  await page.waitForTimeout(2000);

  await expect(page.getByText(/1 entry across 1 category/i)).toBeVisible();
  await expect(page.getByText(/left of budget/i)).toBeVisible();
  expect(errors).toEqual([]);
});
