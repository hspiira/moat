import { expect, type Page } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

export type LedgerRow = {
  id: string;
  amount: number;
  type?: string;
  categoryId?: string;
  transferGroupId?: string;
  feeParentId?: string;
  accountId: string;
};

export async function openSeededApp(page: Page, path = "/transactions") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, buildLedgerFixture());
  await page.goto(path);
  await page.waitForTimeout(1500);

  return { errors };
}

export function readTransactions(page: Page): Promise<LedgerRow[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("moat-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<LedgerRow[]>((resolve, reject) => {
      const request = db.transaction("transactions").objectStore("transactions").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows;
  }) as Promise<LedgerRow[]>;
}

export async function expectLedgerIntact(page: Page) {
  const rows = await readTransactions(page);
  const ids = new Set(rows.map((row) => row.id));

  const orphanedFees = rows.filter((row) => row.feeParentId && !ids.has(row.feeParentId));
  expect(orphanedFees.map((row) => row.id), "fees pointing at a deleted payment").toEqual([]);

  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.transferGroupId) continue;
    groups.set(row.transferGroupId, [...(groups.get(row.transferGroupId) ?? []), row]);
  }

  for (const [id, legs] of groups) {
    const money = legs.filter((leg) => !leg.feeParentId);
    expect(
      money.reduce((sum, leg) => sum + leg.amount, 0),
      `transfer group ${id} does not net to zero`,
    ).toBe(0);
    expect(money.length, `transfer group ${id} has a leg with no partner`).toBeGreaterThan(1);
  }

  return rows;
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the page scrolls horizontally on a phone").toBe(0);
}
