import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

const PIN = "135790";

// Every fresh load locks, so each navigation needs the PIN typed before the app
// is reachable.
async function unlock(page: import("@playwright/test").Page) {
  const keypad = page.getByText(/Moat is locked/i);
  if (await keypad.isVisible().catch(() => false)) {
    await page.keyboard.type(PIN);
    await page.waitForTimeout(2500);
  }
}

// The original projects journey ran with no PIN, so records were stored in the
// clear and userId was a real property. With a PIN set the record is encrypted,
// and a store missing from metadataFields carries no userId to match on: the
// write succeeds and listByUser finds nothing.
test("a project survives a reload once records are encrypted", async ({ page }) => {
  await openSeededApp(page, "/settings");

  await page.getByRole("button", { name: /^Enable PIN lock$/ }).click();
  await page.locator("#new-pin").fill(PIN);
  await page.locator("#confirm-pin").fill(PIN);
  await page.getByRole("button", { name: /^Set PIN$/ }).click();
  await page.waitForTimeout(3000);

  await page.goto("/projects");
  await page.waitForTimeout(1500);
  await unlock(page);
  await page.getByRole("button", { name: "Start a project" }).click();
  await page.locator("#project-name").fill("Relocation");
  await page.getByRole("button", { name: "Start project" }).click();
  await page.waitForTimeout(1500);
  // Scoped to a card title on purpose: the page description contains the word
  // "relocation", and getByText matches substrings case-insensitively, so a
  // looser locator passes whether or not the project was ever saved.
  await expect(page.locator("[data-slot='card-title']", { hasText: "Relocation" })).toBeVisible();

  await page.reload();
  await page.waitForTimeout(1500);
  await unlock(page);

  await expect(
    page.locator("[data-slot='card-title']", { hasText: "Relocation" }),
    "the project did not come back after a reload",
  ).toBeVisible();
});
