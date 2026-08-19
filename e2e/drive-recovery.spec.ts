import { expect, test, type Page } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

type DriveFile = { id: string; name: string; modifiedTime: string; body: string };

function multipartParts(body: string): string[] {
  return body
    .split(/--[-\w]+/)
    .filter((chunk) => chunk.includes("\r\n\r\n"))
    .map((chunk) => chunk.slice(chunk.indexOf("\r\n\r\n") + 4).trim());
}

// Stands in for the whole of Google: an app data folder in memory, and a token
// client that hands over a token without a consent window.
async function stubGoogleDrive(page: Page, shared: DriveFile[] = []) {
  const files = shared;
  let nextId = files.length + 1;

  await page.addInitScript(() => {
    const google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (r: { access_token: string }) => void }) => {
            const client = {
              callback: config.callback,
              requestAccessToken: () => client.callback({ access_token: "e2e-token" }),
            };
            return client;
          },
          revoke: (_token: string, done?: () => void) => done?.(),
        },
      },
    };
    Object.assign(window, { google });
  });

  await page.route(/https:\/\/www\.googleapis\.com\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.startsWith("/upload/drive/v3/files")) {
      const id = url.pathname.split("/").pop() ?? "";

      if (request.method() === "PATCH" && id !== "files") {
        const existing = files.find((file) => file.id === id);
        if (existing) {
          existing.body = request.postData() ?? "";
          existing.modifiedTime = new Date().toISOString();
        }
        return json({ id });
      }

      const [metadata, content] = multipartParts(request.postData() ?? "");
      const name = (JSON.parse(metadata) as { name: string }).name;
      const created = {
        id: `file-${nextId++}`,
        name,
        modifiedTime: new Date().toISOString(),
        body: content ?? "",
      };
      files.push(created);
      return json({ id: created.id });
    }

    if (url.pathname === "/drive/v3/files") {
      const query = url.searchParams.get("q") ?? "";
      const named = /name = '([^']+)'/.exec(query);
      const matching = named ? files.filter((file) => file.name === named[1]) : files;

      return json({
        files: [...matching]
          .sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime))
          .map((file) => ({
            id: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime,
            size: String(file.body.length),
          })),
      });
    }

    const fileId = decodeURIComponent(url.pathname.replace("/drive/v3/files/", ""));

    if (request.method() === "DELETE") {
      const index = files.findIndex((file) => file.id === fileId);
      if (index >= 0) files.splice(index, 1);
      return route.fulfill({ status: 204, body: "" });
    }

    const found = files.find((file) => file.id === fileId);
    return route.fulfill({
      status: found ? 200 : 404,
      contentType: "application/octet-stream",
      body: found?.body ?? "",
    });
  });

  return files;
}

async function openSettingsWithPin(page: Page, pin = "246810") {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, buildLedgerFixture());
  await page.goto("/settings");
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: "Enable PIN lock" }).click();
  await page.locator("#new-pin").fill(pin);
  await page.locator("#confirm-pin").fill(pin);
  await page.getByRole("button", { name: /^Set PIN|Enable PIN|Save PIN/ }).click();
  await page.waitForTimeout(2500);
}

async function connectDrive(page: Page) {
  await page.getByRole("button", { name: "Google Drive backup" }).click();
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await page.waitForTimeout(1200);
}

async function publishVaultAndBackup(page: Page, passphrase: string) {
  await page.locator("#drive-backup-pin").fill("135790");
  await page.locator("#drive-recovery-passphrase").fill(passphrase);
  await page.locator("#drive-recovery-confirm").fill(passphrase);
  await page.getByRole("button", { name: "Upload encrypted backup" }).click();
  await page.waitForTimeout(4000);
}

test("a backup and the key that opens it both reach the drive app folder", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const files = await stubGoogleDrive(page);
  await openSettingsWithPin(page);

  await page.getByRole("button", { name: "Google Drive backup" }).click();
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await page.waitForTimeout(1200);

  await page.locator("#drive-backup-pin").fill("135790");
  await page.locator("#drive-recovery-passphrase").fill("stone bridge over cold water");
  await page.locator("#drive-recovery-confirm").fill("stone bridge over cold water");
  await page.getByRole("button", { name: "Upload encrypted backup" }).click();
  await page.waitForTimeout(4000);

  await expect(page.getByText(/recovery key is now in your Drive app folder/i)).toBeVisible();

  const vault = files.find((file) => file.name === "moat-key-vault.json");
  expect(vault, "no key vault reached the app data folder").toBeTruthy();
  expect(files.some((file) => /^moat-backup-.*\.enc$/.test(file.name))).toBe(true);

  // The vault holds a wrapped key and nothing readable.
  const parsed = JSON.parse(vault?.body ?? "{}") as Record<string, unknown>;
  expect(parsed.version).toBe(1);
  expect(parsed.passphrase).toBeTruthy();
  expect(vault?.body).not.toContain("transactions");

  expect(errors).toEqual([]);
});

test("with the key in place a backup can be taken without a PIN", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const files = await stubGoogleDrive(page);
  await openSettingsWithPin(page);

  await page.getByRole("button", { name: "Google Drive backup" }).click();
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await page.waitForTimeout(1200);

  await page.locator("#drive-backup-pin").fill("135790");
  await page.locator("#drive-recovery-passphrase").fill("stone bridge over cold water");
  await page.locator("#drive-recovery-confirm").fill("stone bridge over cold water");
  await page.getByRole("button", { name: "Upload encrypted backup" }).click();
  await page.waitForTimeout(4000);

  await page.getByRole("button", { name: /Back up now, without a PIN/i }).click();
  await page.waitForTimeout(4000);

  expect(files.some((file) => /^moat-sealed-.*\.enc$/.test(file.name))).toBe(true);
  await expect(page.getByText(/opens with your recovery passphrase/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the recovery file can be saved as a copy, and refuses a wrong passphrase", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await stubGoogleDrive(page);
  await openSettingsWithPin(page);

  await page.getByRole("button", { name: "Google Drive backup" }).click();
  await page.getByRole("button", { name: "Connect Google Drive" }).click();
  await page.waitForTimeout(1200);

  await page.locator("#drive-backup-pin").fill("135790");
  await page.locator("#drive-recovery-passphrase").fill("stone bridge over cold water");
  await page.locator("#drive-recovery-confirm").fill("stone bridge over cold water");
  await page.getByRole("button", { name: "Upload encrypted backup" }).click();
  await page.waitForTimeout(4000);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Save a copy of the recovery file/i }).click();
  expect((await download).suggestedFilename()).toBe("moat-key-vault.json");

  await page.getByRole("button", { name: /Open this ledger on this device/i }).click();
  await page.locator("#adopt-passphrase").fill("not the right passphrase");
  await page.locator("#adopt-device-pin").fill("246810");
  await page.getByRole("button", { name: /Open with passphrase/i }).click();
  await page.waitForTimeout(3000);

  await expect(page.getByText(/does not open this vault/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a second device opens the ledger with nothing but the recovery passphrase", async ({
  browser,
}) => {
  // Two devices, a PIN set on each, and a full re-key in between.
  test.setTimeout(120_000);

  const passphrase = "stone bridge over cold water";
  const drive: DriveFile[] = [];

  const firstDevice = await browser.newContext();
  const deviceA = await firstDevice.newPage();
  await stubGoogleDrive(deviceA, drive);
  await openSettingsWithPin(deviceA);
  await connectDrive(deviceA);
  await publishVaultAndBackup(deviceA, passphrase);
  await deviceA.getByRole("button", { name: /Back up now, without a PIN/i }).click();
  await deviceA.waitForTimeout(4000);
  await firstDevice.close();

  expect(drive.some((file) => /^moat-sealed-/.test(file.name))).toBe(true);

  // A different device: its own PIN, its own key, and no idea what the first
  // device's backup PIN was.
  const secondDevice = await browser.newContext();
  const deviceB = await secondDevice.newPage();
  const errors: string[] = [];
  deviceB.on("pageerror", (error) => errors.push(error.message));

  await stubGoogleDrive(deviceB, drive);
  await openSettingsWithPin(deviceB, "975310");
  await connectDrive(deviceB);

  const sealedRow = deviceB
    .locator("div")
    .filter({ hasText: /^moat-sealed-/ })
    .getByRole("button", { name: /Restore this backup/i })
    .first();

  await sealedRow.click();
  await deviceB.waitForTimeout(3000);
  await expect(
    deviceB.getByText(/was not made with this device/i),
    "a sealed backup must not open before the key is adopted",
  ).toBeVisible();

  await deviceB.getByRole("button", { name: /Open this ledger on this device/i }).click();
  await deviceB.locator("#adopt-passphrase").fill(passphrase);
  await deviceB.locator("#adopt-device-pin").fill("975310");
  await deviceB.getByRole("button", { name: /Open with passphrase/i }).click();
  await deviceB.waitForTimeout(6000);

  await expect(deviceB.getByText(/now holds the ledger.s key/i)).toBeVisible();

  await sealedRow.click();
  await deviceB.waitForTimeout(4000);
  await expect(deviceB.getByText(/restored successfully/i)).toBeVisible();

  expect(errors).toEqual([]);
  await secondDevice.close();
});
