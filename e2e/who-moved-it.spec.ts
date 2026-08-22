import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

test("the report says who took money and who paid you", async ({ page }) => {
  await openSeededApp(page, "/report");

  const card = page
    .locator("[data-slot='card']")
    .filter({ hasText: "Who took it, and who paid you" });
  await expect(card).toBeVisible();

  const took = card.locator("section", { hasText: "Took money" });
  const paid = card.locator("section", { hasText: "Paid you" });

  // The two directions stay apart: a salary is not netted against a boda fare.
  await expect(took).toContainText("Boda Rider");
  await expect(paid).toContainText("Employer");
  await expect(took).not.toContainText("Employer");

  // What one payment costs, not only the total.
  await expect(took).toContainText("each time");

  // Moving money between the owner's own accounts has no other party.
  await expect(card).not.toContainText("Own Transfer");

  await card.getByRole("link", { name: /Boda Rider/ }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("Boda Rider");
});

test("a long parsed payee does not push its amount off the card", async ({ page }) => {
  await openSeededApp(page, "/report");

  const card = page
    .locator("[data-slot='card']")
    .filter({ hasText: "Who took it, and who paid you" });
  await card.scrollIntoViewIfNeeded();

  // The card clips its overflow, so the page does not widen and a sideways
  // scroll check would pass while the amount sat outside the card unseen.
  const row = card.getByRole("link", { name: /A VERY LONG COUNTERPARTY NAME/ });
  const amount = row.locator("[data-slot='money']").first();

  const cardBox = await card.boundingBox();
  const amountBox = await amount.boundingBox();

  expect(cardBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(amountBox!.x + amountBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  await expectNoSidewaysScroll(page);
});
