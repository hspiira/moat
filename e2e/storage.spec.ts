import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

test("asks the browser to keep the ledger", async ({ page }) => {
  const calls: string[] = [];
  await page.addInitScript(() => {
    const storage = navigator.storage as StorageManager & { __calls?: string[] };
    const persist = storage.persist?.bind(storage);
    storage.__calls = [];
    storage.persist = async () => {
      storage.__calls!.push("persist");
      return persist ? persist() : false;
    };
  });

  await openSeededApp(page, "/settings");
  const seen = await page.evaluate(
    () => (navigator.storage as StorageManager & { __calls?: string[] }).__calls ?? [],
  );
  calls.push(...seen);

  const persisted = await page.evaluate(() => navigator.storage.persisted());
  expect(persisted || calls.includes("persist")).toBe(true);
});

test("says plainly when the browser will not promise to keep the data", async ({ page }) => {
  await page.addInitScript(() => {
    const storage = navigator.storage as StorageManager;
    storage.persisted = async () => false;
    storage.persist = async () => false;
    storage.estimate = async () => ({ usage: 1_000, quota: 100_000 });
  });

  const { errors } = await openSeededApp(page, "/settings");
  await expect(
    page.getByText(/has not promised to keep your records/i).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("warns when the device is nearly full", async ({ page }) => {
  await page.addInitScript(() => {
    const storage = navigator.storage as StorageManager;
    storage.persisted = async () => true;
    storage.estimate = async () => ({ usage: 97_000, quota: 100_000 });
  });

  await openSeededApp(page, "/settings");
  await expect(page.getByText(/nearly full/i).first()).toBeVisible();
});
