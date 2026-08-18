import { expect, test, type Page } from "@playwright/test";

import { SEEDED_SLUGS, transfersCategoryId } from "@/lib/domain/seeded-ids";
import { deriveSeededId } from "@/lib/ids";

import { ACCOUNTS, buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { expectNoSidewaysScroll } from "./harness";
import { seedIndexedDb } from "./seed-indexeddb";

const STAMP = "2026-08-17T09:00:00.000Z";

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

const saccoLoan = {
  id: "e2e-account-sacco",
  userId: USER_ID,
  name: "SACCO loan",
  type: "debt" as const,
  openingBalance: -1_200_000,
  balance: -1_200_000,
  debtPrincipal: 1_200_000,
  debtInterestRate: 18,
  debtInterestModel: "reducing_balance" as const,
  debtStartDate: "2026-05-01",
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const debtCategory = {
  id: "e2e-category-debt",
  userId: USER_ID,
  name: "Debt repayment",
  kind: "debt_repayment" as const,
  isDefault: true,
  createdAt: STAMP,
};

const lenders = ["Auntie Grace", "Jonah", "Moses", "Peter", "Ruth", "Sarah"].map(
  (name, index) => ({
    id: `e2e-lender-${index}`,
    userId: USER_ID,
    name,
    kind: "lender" as const,
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  }),
);

const borrowedFromGrace = {
  userId: USER_ID,
  type: "transfer" as const,
  currency: "UGX" as const,
  originalAmount: 500_000,
  occurredOn: "2026-08-04",
  categoryId: transfersCategoryId(USER_ID),
  counterpartyId: "e2e-lender-0",
  transferGroupId: "e2e-group-borrow",
  reconciliationState: "posted" as const,
  source: "manual" as const,
  createdAt: STAMP,
  updatedAt: STAMP,
};

async function openRepaymentForm(page: Page) {
  const fixture = buildLedgerFixture();

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    accounts: [...fixture.accounts, borrowingPool, saccoLoan],
    categories: [...fixture.categories, debtCategory],
    counterparties: lenders,
    transactions: [
      ...fixture.transactions,
      { ...borrowedFromGrace, id: "e2e-borrowed-in", accountId: ACCOUNTS.momo.id, amount: 500_000 },
      {
        ...borrowedFromGrace,
        id: "e2e-borrowed-owed",
        accountId: borrowingPool.id,
        amount: -500_000,
      },
    ],
  });

  await page.goto("/transactions/capture?capture=transfer&type=transfer");
  await page.getByLabel("Amount (UGX)").fill("200000");
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Momo Wallet" }).click();
  await page.getByLabel("To account").click();
  await page.getByRole("option", { name: "Money borrowed" }).click();
}

test("a lender is found by typing rather than scrolling the list", async ({ page }) => {
  await openRepaymentForm(page);

  await page.getByRole("button", { name: /Who you are repaying/ }).click();
  await page.getByLabel("Search people").fill("gra");

  await expect(page.getByRole("button", { name: /Auntie Grace/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sarah/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Auntie Grace/ }).click();

  await expect(page.getByRole("button", { name: /Who you are repaying/ })).toContainText(
    "Auntie Grace",
  );
  await expect(page.getByText(/You owe USh\s500,000 · since 4 Aug/)).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("a part payment says what it leaves behind", async ({ page }) => {
  await openRepaymentForm(page);

  await page.getByRole("button", { name: /Who you are repaying/ }).click();
  await page.getByRole("button", { name: /Auntie Grace/ }).click();

  await expect(page.getByText(/Leaves USh\s300,000 outstanding/)).toBeVisible();
});

test("paying it all fills the amount and says the debt clears", async ({ page }) => {
  await openRepaymentForm(page);

  await page.getByRole("button", { name: /Who you are repaying/ }).click();
  await page.getByRole("button", { name: /Auntie Grace/ }).click();
  await page.getByRole("button", { name: "Pay it all" }).click();

  await expect(page.getByLabel("Amount (UGX)")).toHaveValue("500000");
  await expect(page.getByText("Clears it.")).toBeVisible();
});

test("a new lender is added from the picker without a second field", async ({ page }) => {
  await openRepaymentForm(page);

  await page.getByRole("button", { name: /Who you are repaying/ }).click();
  await page.getByLabel("Search people").fill("Mama Zuena");
  await page.getByRole("button", { name: /Add “Mama Zuena”/ }).click();

  await expect(page.getByRole("button", { name: /Who you are repaying/ })).toContainText(
    "Mama Zuena",
  );
  await expect(page.getByLabel("Their name")).toHaveCount(0);
});

test("a loan payment shows the interest and principal split before saving", async ({ page }) => {
  await openRepaymentForm(page);

  await page.goto("/transactions/capture?capture=expense&type=expense");
  await page.getByLabel("Amount (UGX)").fill("150000");
  await page.getByLabel("Category").click();
  await page.getByLabel("Search categories").fill("Debt");
  await page.getByRole("button", { name: "Debt repayment" }).click();
  await page.getByLabel("From account").click();
  await page.getByRole("option", { name: "Momo Wallet" }).click();
  await page.getByLabel("Which loan").click();
  await page.getByRole("option", { name: /SACCO loan/ }).click();

  await expect(page.getByText(/Still owed USh\s1,200,000/)).toBeVisible();
  await expect(page.getByText(/interest ·/)).toContainText("off the balance");
  await expect(page.getByText(/Leaves USh\s1,113,912 outstanding/)).toBeVisible();
});
