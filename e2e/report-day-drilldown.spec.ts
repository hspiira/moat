import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

test("the calendar opens on today and lists what made up the day", async ({ page }) => {
  const { errors } = await openSeededApp(page, "/report");

  // The clock is frozen at 17 August, and the fixture records that day.
  await expect(page.getByRole("heading", { name: /Monday, 17 August/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("picking another day swaps the list under the calendar", async ({ page }) => {
  await openSeededApp(page, "/report");

  await page.getByRole("button", { name: /^2026-08-16/ }).click();
  await page.waitForTimeout(600);

  await expect(page.getByRole("heading", { name: /Sunday, 16 August/i })).toBeVisible();
  await expect(page.getByText("3 entries")).toBeVisible();
});

test("spending in the day list reads as money out, not in", async ({ page }) => {
  await openSeededApp(page, "/report");

  await page.getByRole("button", { name: /^2026-08-16/ }).click();
  await page.waitForTimeout(600);

  const heading = page.getByRole("heading", { name: /Sunday, 16 August/i });
  const list = heading.locator("xpath=../following-sibling::ul[1]");

  // Every row that day is spending. Stored amounts are positive, so a row that
  // shows "+" means the sign came from the amount rather than its effect.
  await expect(list.getByText(/^\+/)).toHaveCount(0);
  await expect(list.getByText(/^−Sh/).first()).toBeVisible();
});

test("a long parsed payee does not push the calendar sideways", async ({ page }) => {
  await openSeededApp(page, "/report");

  // The 16th holds the fixture's unbroken parser output. The day list is a grid
  // item, so without min-w-0 it sizes to that text and drags the calendar with it.
  await page.getByRole("button", { name: /^2026-08-16/ }).click();
  await page.waitForTimeout(600);

  await expectNoSidewaysScroll(page);
});
