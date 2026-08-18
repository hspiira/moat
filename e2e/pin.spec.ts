import { expect, test } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

test("settings says plainly that no PIN means no encryption", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, buildLedgerFixture());
  await page.goto("/settings");
  await page.waitForTimeout(2000);

  await expect(page.getByText(/records are stored unencrypted/i).first()).toBeVisible();
  await expect(page.getByText(/encrypts your records on this device/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("onboarding reaches the security step and names what turning the PIN off costs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/onboarding");
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Start fresh/ }).click();
  await page.waitForTimeout(1000);

  await page.locator("#display-name").fill("E2E Tester");
  await page.locator("#horizon").fill("2");
  await page.locator("#consent").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(800);

  await page.locator("#account-name").fill("Pocket Cash");
  await page.locator("#opening-balance").fill("400000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(800);

  await page.locator("#goal-enabled").uncheck();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(800);

  const toggle = page.locator("#security-enabled");
  await expect(toggle, "onboarding never reached the security step").toBeVisible();
  await expect(toggle, "a PIN is not the default").toBeChecked();

  await toggle.uncheck();
  await expect(page.getByText(/stored unencrypted/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});
