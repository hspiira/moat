import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

test("the report says what each account costs you to move money through", async ({ page }) => {
  await openSeededApp(page, "/report");

  const card = page
    .locator("[data-slot='card']")
    .filter({ hasText: "What moving money cost you" });

  await expect(card).toBeVisible();
  await expect(card).toContainText("Momo Wallet");
  // The rate, not just the total, because the busiest account is not
  // automatically the dearest one.
  await expect(card).toContainText("per Sh 1,000");

  await card.getByRole("link", { name: /Momo Wallet/ }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("Momo Wallet");
});
