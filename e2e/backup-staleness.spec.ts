import { expect, test, type Page } from "@playwright/test";

import { expectLedgerIntact, expectNoSidewaysScroll, openSeededApp } from "./harness";

const NOTICE = /last backup was \d+ days ago/i;

async function seedBackupTaken(page: Page, lastBackupAt: string) {
  await page.addInitScript((takenAt) => {
    const storage = navigator.storage as StorageManager;
    storage.persisted = async () => true;
    storage.persist = async () => true;
    storage.estimate = async () => ({ usage: 1_000, quota: 1_000_000 });
    window.localStorage.setItem(
      "moat.google-drive-backup",
      JSON.stringify({
        provider: "google_drive",
        wasConnected: true,
        lastBackupAt: takenAt,
        lastBackupName: "moat-backup-2026-06-18.json",
      }),
    );
  }, lastBackupAt);
}

test("says how long it has been since the last backup", async ({ page }) => {
  await seedBackupTaken(page, "2026-06-18T09:00:00.000Z");

  const { errors } = await openSeededApp(page, "/transactions");

  await expect(page.getByText(NOTICE).first()).toBeVisible();
  await expect(page.getByText(/last backup was 60 days ago/i).first()).toBeVisible();
  await expectLedgerIntact(page);
  await expectNoSidewaysScroll(page);
  expect(errors).toEqual([]);
});

test("stays quiet when the backup is recent", async ({ page }) => {
  await seedBackupTaken(page, "2026-08-16T09:00:00.000Z");

  const { errors } = await openSeededApp(page, "/transactions");

  await expect(page.getByText(NOTICE)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keeps the staleness notice dismissed across a reload", async ({ page }) => {
  await seedBackupTaken(page, "2026-06-18T09:00:00.000Z");
  await openSeededApp(page, "/transactions");

  await page.getByRole("button", { name: /dismiss storage warning/i }).click();
  await expect(page.getByText(NOTICE)).toHaveCount(0);

  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
