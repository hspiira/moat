import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

// Bills and budgets are two halves of one plan. Stacking them put budgets
// below every bill the month had ever recorded, so either half is now one tap
// away and the old routes still name the half they meant.

test("the plan opens on bills and can switch to budgets", async ({ page }) => {
  await openSeededApp(page, "/plan");

  await expect(page.getByRole("heading", { name: "Bills that repeat" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Budgets" }).click();

  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bills that repeat" })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});

test("/budgets arrives with budgets already selected", async ({ page }) => {
  await openSeededApp(page, "/budgets");

  await expect(page).toHaveURL(/\/plan\?section=budgets$/);
  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();
});

test("/recurring arrives with bills already selected", async ({ page }) => {
  await openSeededApp(page, "/recurring");

  await expect(page).toHaveURL(/\/plan\?section=bills$/);
  await expect(page.getByRole("heading", { name: "Bills that repeat" })).toBeVisible();
});

// Whichever half you were last in is the one you come back to.
test("the plan reopens on the section you last used", async ({ page }) => {
  await openSeededApp(page, "/plan");
  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();

  await page.goto("/plan");
  await page.waitForTimeout(1500);

  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();
});
