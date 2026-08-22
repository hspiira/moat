import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

test("the goals page asks three separate questions, with one ring", async ({ page }) => {
  await openSeededApp(page, "/goals");

  await expect(page.getByRole("heading", { name: "Your goals" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Your emergency fund" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Money you are not spending" })).toBeVisible();

  // One hero at most, never two competing ones. Both rings used to measure the
  // emergency fund, one as a percentage and one in months.
  await expect(page.getByRole("img", { name: /Emergency fund/ })).toHaveCount(0);
  await expect(page.getByText("of 3 months")).toBeVisible();

  // Nothing set aside yet, so the useful thing is a way to start.
  await expect(page.getByRole("button", { name: "Start an emergency fund" })).toBeVisible();
});

test("the goal list does not repeat the heading above it", async ({ page }) => {
  await openSeededApp(page, "/goals");

  await expect(page.getByRole("button", { name: "New goal" })).toHaveCount(1);
});
