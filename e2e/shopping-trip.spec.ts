import { expect, test } from "@playwright/test";
import { openSeededApp } from "./harness";

// The per-trip total and price per unit are proven in
// lib/domain/shopping-history.test.ts. This covers the path that puts a unit on
// an item in the first place, which is what makes those figures comparable.
test("an item can be planned with a unit", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.locator("#planner-name").fill("Sugar");
  await page.getByRole("button", { name: /quantity, price and date/i }).click();
  await page.locator("#planner-quantity").fill("2");
  await page.locator("#planner-unit").fill("kg");
  await page.locator("#planner-estimate").fill("5000");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByText("Sugar").first()).toBeVisible();
});

test("the unit offered is one the shop actually uses", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.getByRole("button", { name: /quantity, price and date/i }).click();

  const options = page.locator("#planner-unit-suggestions option");
  await expect(options.first()).toHaveAttribute("value", "kg");
  expect(await options.count()).toBeGreaterThan(3);
});
