import { expect, test } from "@playwright/test";

import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

const KEEP = "Not a duplicate, keep both";

async function openWithTwinPayments(page: import("@playwright/test").Page) {
  const fixture = buildLedgerFixture();
  const template = fixture.transactions[0];
  const twin = {
    ...template,
    id: "e2e-tx-twin-a",
    payee: "Boda rider",
    note: undefined,
    amount: 3_000,
    originalAmount: 3_000,
    type: "expense" as const,
  };

  fixture.transactions = [
    ...fixture.transactions,
    twin,
    { ...twin, id: "e2e-tx-twin-b" },
  ];

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, fixture);
  await page.goto("/month");
  await page.waitForTimeout(1500);
}

test("a payment that only looks like a duplicate can be kept, and stays kept", async ({ page }) => {
  await openWithTwinPayments(page);

  const keep = page.getByRole("button", { name: KEEP });
  await expect(keep).toBeVisible();

  await keep.click();
  await expect(page.getByRole("button", { name: KEEP })).toHaveCount(0);
  await expect(page.getByText("No duplicates")).toBeVisible();

  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("button", { name: KEEP })).toHaveCount(0);
});
