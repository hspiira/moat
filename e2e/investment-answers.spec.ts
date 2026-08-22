import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

const MARKET_CLASS = "Short-duration conservative funds";

test("an answer about risk changes what is suggested", async ({ page }) => {
  await openSeededApp(page, "/goals");

  await expect(page.getByText("What this is based on")).toBeVisible();
  await expect(page.getByText(MARKET_CLASS)).toBeVisible();

  await page.getByRole("button", { name: "Change your answers" }).click();
  await page.getByLabel("Comfort if the value falls").click();
  await page.getByRole("option", { name: "Low" }).click();
  await page.getByRole("button", { name: "Save answers" }).click();

  await expect(page.getByText(MARKET_CLASS)).toHaveCount(0);
  await expect(page.getByText("Comfort if the value falls").locator("..")).toContainText("Low");
});

test("the suggestions point at the regulator that licenses them", async ({ page }) => {
  await openSeededApp(page, "/goals");

  await expect(
    page.getByText("Where money like this usually goes", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("not a recommendation", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Capital Markets Authority Uganda/ }).first()).toBeVisible();
});
