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
  await page.locator("#planner-unit").click();
  await page.getByPlaceholder("Search or type a unit").fill("kg");
  await page.getByRole("button", { name: "kg", exact: true }).click();
  await page.locator("#planner-estimate").fill("5000");
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByText("Sugar").first()).toBeVisible();
});

/* Units are offered rather than typed from memory, or one shop ends up holding
   "kg", "Kg" and "kgs" as three units that never compare. */
test("the unit offered is one the shop actually uses", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.getByRole("button", { name: /quantity, price and date/i }).click();
  await page.locator("#planner-unit").click();

  await expect(page.getByRole("button", { name: "kg", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "litre", exact: true })).toBeVisible();
});

test("a unit already in use is offered rather than added again", async ({ page }) => {
  await openSeededApp(page, "/shopping");

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.getByRole("button", { name: /quantity, price and date/i }).click();
  await page.locator("#planner-unit").click();
  await page.getByPlaceholder("Search or type a unit").fill("kg");

  await expect(page.getByRole("button", { name: "kg", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add “kg”$/ })).toHaveCount(0);
});
