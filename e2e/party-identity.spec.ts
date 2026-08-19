import { expect, test } from "@playwright/test";

import { transfersCategoryId } from "@/lib/domain/seeded-ids";
import { SEEDED_SLUGS } from "@/lib/domain/seeded-ids";
import { deriveSeededId } from "@/lib/ids";

import { ACCOUNTS, buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { expectLedgerIntact } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

const STAMP = "2026-08-16T09:00:00.000Z";
const STALE_TEXT = "GRACE MOB 0700111222";

const borrowingPool = {
  id: deriveSeededId(USER_ID, SEEDED_SLUGS.borrowingPool),
  userId: USER_ID,
  name: "Money borrowed",
  type: "debt" as const,
  openingBalance: 0,
  balance: -500_000,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const grace = {
  id: "e2e-lender-grace",
  userId: USER_ID,
  name: "Auntie Grace",
  kind: "lender" as const,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const leg = {
  userId: USER_ID,
  type: "transfer" as const,
  currency: "UGX" as const,
  originalAmount: 500_000,
  occurredOn: "2026-08-16",
  categoryId: transfersCategoryId(USER_ID),
  transferGroupId: "e2e-group-grace",
  payee: STALE_TEXT,
  reconciliationState: "posted" as const,
  source: "manual" as const,
  createdAt: STAMP,
  updatedAt: STAMP,
};

async function openWithGrace(page: import("@playwright/test").Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  const fixture = buildLedgerFixture();

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    accounts: [...fixture.accounts, borrowingPool],
    counterparties: [grace],
    transactions: [
      ...fixture.transactions,
      { ...leg, id: "e2e-grace-in", accountId: ACCOUNTS.momo.id, amount: 500_000 },
      {
        ...leg,
        id: "e2e-grace-owed",
        accountId: borrowingPool.id,
        amount: -500_000,
        counterpartyId: grace.id,
      },
    ],
  });
  await page.goto(path);
  await page.waitForTimeout(2000);

  return { errors };
}

test("a row that names a person shows that person, not the text it was parsed from", async ({
  page,
}) => {
  const { errors } = await openWithGrace(page, "/transactions");

  await page.getByRole("searchbox").first().fill("Grace");
  await page.waitForTimeout(1000);

  await expect(page.getByText("Auntie Grace").first()).toBeVisible();
  await expect(page.getByText(STALE_TEXT)).toHaveCount(0);
  await expectLedgerIntact(page);
  expect(errors).toEqual([]);
});

test("a lender appears once, however the rows spell her", async ({ page }) => {
  const { errors } = await openWithGrace(page, "/debt");

  await expect(page.getByText("Auntie Grace")).toHaveCount(1);
  await expect(page.getByText(STALE_TEXT)).toHaveCount(0);
  expect(errors).toEqual([]);
});
