import { expect, test, type Page } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { expectLedgerIntact, openSeededApp, readTransactions } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

async function armStorageFailure(page: Page) {
  await page.addInitScript(() => {
    const realPut = IDBObjectStore.prototype.put;
    const armed = window as unknown as { __failWritesAfter?: number };
    let seen = 0;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: unknown[]) {
      if (typeof armed.__failWritesAfter === "number" && this.name === "transactions") {
        seen += 1;
        if (seen > armed.__failWritesAfter) {
          throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        }
      }
      return (realPut as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as typeof IDBObjectStore.prototype.put;
  });
}

test("a write that dies halfway leaves no half-written transfer", async ({ page }) => {
  await armStorageFailure(page);
  await openSeededApp(page, "/transactions");
  const before = await readTransactions(page);

  await page.getByRole("searchbox").first().fill("Own Transfer");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Details for Own Transfer/ }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  await page.evaluate(() => {
    (window as unknown as { __failWritesAfter?: number }).__failWritesAfter = 1;
  });

  await page.locator("#tx-amount").fill("77000");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await page.waitForTimeout(2000);

  await expect(page.getByText(/quota has been exceeded/i).first()).toBeVisible();

  const after = await expectLedgerIntact(page);
  expect(after.length, "a failed save changed the number of rows").toBe(before.length);
  expect(
    after.filter((row) => Math.abs(row.amount) === 77_000),
    "a failed save left one of its rows behind",
  ).toEqual([]);
});

test("a truncated backup file is refused and the ledger is left alone", async ({ page }) => {
  const { errors } = await openSeededApp(page, "/settings");
  const before = await readTransactions(page);

  await page.getByRole("button", { name: /Restore from backup/i }).click();
  await page.locator("#restore-file").setInputFiles({
    name: "moat-backup-truncated.enc",
    mimeType: "application/octet-stream",
    buffer: Buffer.from('{"salt":"abc","iv":"def","ciphert'),
  });
  await page.getByRole("button", { name: /^Restore backup$/ }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText(/isn't a Moat backup/i).first()).toBeVisible();

  const after = await readTransactions(page);
  expect(after.length, "a refused restore changed the ledger").toBe(before.length);
  await expectLedgerIntact(page);
  expect(errors).toEqual([]);
});

test("a file that is JSON but not a backup is named as such", async ({ page }) => {
  await openSeededApp(page, "/settings");
  const before = await readTransactions(page);

  await page.getByRole("button", { name: /Restore from backup/i }).click();
  await page.locator("#restore-file").setInputFiles({
    name: "shopping-list.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"milk":2,"bread":1}'),
  });
  await page.getByRole("button", { name: /^Restore backup$/ }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText(/not a Moat backup or export/i).first()).toBeVisible();

  const after = await readTransactions(page);
  expect(after.length, "a refused restore changed the ledger").toBe(before.length);
});

test("a real backup restored with the wrong PIN changes nothing", async ({ page }) => {
  await openSeededApp(page, "/settings");
  const before = await readTransactions(page);

  await page.getByRole("button", { name: /Download encrypted backup/i }).click();
  await page.locator("#backup-pin").fill("135790");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Encrypt and download/i }).click();
  const download = await downloading;
  const backupPath = await download.path();
  expect(backupPath, "the app produced no backup file to restore").toBeTruthy();

  await page.getByRole("button", { name: /Restore from backup/i }).click();
  await page.locator("#restore-file").setInputFiles(backupPath!);
  await page.locator("#restore-pin").fill("246800");
  await page.getByRole("button", { name: /^Restore backup$/ }).click();
  await page.waitForTimeout(2500);

  await expect(page.getByText(/Could not decrypt this backup/i).first()).toBeVisible();

  const after = await readTransactions(page);
  expect(after.length, "a failed decrypt changed the ledger").toBe(before.length);
  await expectLedgerIntact(page);
});

test("one unreadable record does not take the ledger down with it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  const bundle = buildLedgerFixture();
  const readable = bundle.transactions.length - 1;
  const poisoned = bundle.transactions[0];
  bundle.transactions[0] = {
    id: poisoned.id,
    userId: poisoned.userId,
    occurredOn: poisoned.occurredOn,
    __moatEncrypted: true,
    __moatEnvelopeVersion: 2,
    iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "bm90IGV2ZW4gY2xvc2UgdG8gcmVhbCBjaXBoZXJ0ZXh0",
  } as unknown as (typeof bundle.transactions)[number];

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, bundle);
  await page.goto("/transactions");
  await page.waitForTimeout(2500);

  await expect(page.getByText("Ledger")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Details for / }).first()).toBeVisible();
  await expect(page.getByText(`${readable}`, { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("repeated wrong PINs stop being guessable", async ({ page }) => {
  await openSeededApp(page, "/settings");

  await page.getByRole("button", { name: /^Enable PIN lock$/ }).click();
  await page.locator("#new-pin").fill("111111");
  await page.locator("#confirm-pin").fill("111111");
  await page.getByRole("button", { name: /^Set PIN$/ }).click();
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: /^Lock now$/ }).click();
  await page.waitForTimeout(1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.type("222222");
    await page.waitForTimeout(700);
  }

  await expect(page.getByText(/Too many attempts/i).first()).toBeVisible();
});
