import { expect, test } from "@playwright/test";

import { ACCOUNTS, buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { seededCategoryId } from "@/lib/domain/seeded-ids";
import { seedIndexedDb } from "./seed-indexeddb";

test("a charge insight lands on the charges themselves", async ({ page }) => {
  const fixture = buildLedgerFixture();
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, fixture);

  await page.goto("/transactions?q=Fees%20%26%20charges");
  await page.waitForTimeout(1500);

  await expect(page.getByRole("searchbox")).toHaveValue("Fees & charges");
});

test("an out-of-step account shows which entries to check", async ({ page }) => {
  const fixture = buildLedgerFixture();
  const accountId = ACCOUNTS.momo.id;
  const categoryId = seededCategoryId(USER_ID, "Food");

  const row = (id: string, day: string, amount: number, statedBalance?: number) => ({
    id,
    userId: USER_ID,
    accountId,
    type: "expense" as const,
    amount,
    currency: "UGX" as const,
    originalAmount: amount,
    occurredOn: day,
    categoryId,
    reconciliationState: "posted" as const,
    source: "sms" as const,
    payee: `Entry ${id}`,
    statedBalance,
    createdAt: `${day}T08:00:00.000Z`,
    updatedAt: `${day}T08:00:00.000Z`,
  });

  fixture.transactions = [
    row("gap-open", "2026-08-01", 1_000, 100_000),
    row("gap-inside", "2026-08-05", 4_000),
    row("gap-close", "2026-08-10", 2_000, 80_000),
  ];

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, fixture);
  await page.goto(`/accounts/detail?id=${encodeURIComponent(accountId)}`);
  await page.waitForTimeout(1500);

  // Stated 80,000 against the 94,000 the entries add up to leaves 14,000 missing.
  const band = page.locator("section").filter({ hasText: "is spent but not recorded" }).first();
  await expect(band).toBeVisible();
  await expect(band).toContainText("Sh 14,000");

  // Only the entries after the balance that was already agreed.
  await expect(band.getByRole("listitem")).toHaveCount(2);
  await expect(band).toContainText("Entry gap-inside");
  await expect(band).not.toContainText("Entry gap-open");
  await expect(band.getByRole("button", { name: "Record what is missing" })).toBeVisible();
});

test("a spending row on the report leads to its transactions", async ({ page }) => {
  const fixture = buildLedgerFixture();
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, fixture);
  await page.goto("/report");
  await page.waitForTimeout(1500);

  await expect(page.getByText("Where it went")).toBeVisible();
  const row = page.getByRole("link", { name: /Transport/ }).first();
  await row.click();
  await page.waitForTimeout(1500);

  await expect(page.getByRole("searchbox")).toHaveValue(/Transport/);
});
