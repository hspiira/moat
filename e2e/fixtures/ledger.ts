import { deriveSeededId } from "@/lib/ids";
import {
  feesCategoryId,
  seededCategoryId,
  SEEDED_SLUGS,
  transfersCategoryId,
} from "@/lib/domain/seeded-ids";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";

export const USER_ID = "user:e2e";
export const TODAY = "2026-08-17";
const STAMP = `${TODAY}T09:00:00.000Z`;

/** Frozen so "this month" and the default date never drift with the clock. */
export const FIXED_NOW = new Date(`${TODAY}T09:00:00.000Z`);

const account = (
  id: string,
  name: string,
  type: Account["type"],
  openingBalance = 0,
): Account => ({
  id,
  userId: USER_ID,
  name,
  type,
  openingBalance,
  balance: openingBalance,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
});

export const ACCOUNTS = {
  cash: account("e2e-account-cash", "Pocket Cash", "cash", 400_000),
  momo: account("e2e-account-momo", "Momo Wallet", "mobile_money", 250_000),
  bank: account("e2e-account-bank", "Town Bank", "bank", 3_400_000),
  lendingPool: account(
    deriveSeededId(USER_ID, SEEDED_SLUGS.lendingPool),
    "Money lent out",
    "receivable",
  ),
};

const category = (name: string, kind: Category["kind"]): Category => ({
  id: seededCategoryId(USER_ID, name),
  userId: USER_ID,
  name,
  kind,
  isDefault: true,
  createdAt: STAMP,
});

export const CATEGORIES: Category[] = [
  category("Food", "expense"),
  category("Transport", "expense"),
  category("Airtime", "expense"),
  category("Salary", "income"),
  { ...category("Transfers", "transfer"), id: transfersCategoryId(USER_ID) },
  { ...category("Fees & charges", "expense"), id: feesCategoryId(USER_ID) },
  { ...category("Lending", "transfer"), id: seededCategoryId(USER_ID, "Lending") },
];

const CATEGORY = Object.fromEntries(CATEGORIES.map((entry) => [entry.name, entry.id])) as Record<
  string,
  string
>;

type Seed = {
  id: string;
  day: string;
  amount: number;
  categoryName: string;
  payee?: string;
  note?: string;
  accountId?: string;
  type?: Transaction["type"];
};

const transaction = (seed: Seed): Transaction => ({
  id: seed.id,
  userId: USER_ID,
  accountId: seed.accountId ?? ACCOUNTS.cash.id,
  type: seed.type ?? "expense",
  amount: seed.amount,
  currency: "UGX",
  originalAmount: Math.abs(seed.amount),
  occurredOn: seed.day,
  categoryId: CATEGORY[seed.categoryName],
  reconciliationState: "posted",
  source: "manual",
  payee: seed.payee,
  note: seed.note,
  createdAt: `${seed.day}T08:00:00.000Z`,
  updatedAt: `${seed.day}T08:00:00.000Z`,
});

const day = (offset: number) => {
  const date = new Date(`${TODAY}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

// 60 ordinary rows so the 40-per-page account history has a second page.
const ROUTINE: Transaction[] = Array.from({ length: 60 }, (_, index) =>
  transaction({
    id: `e2e-tx-routine-${String(index).padStart(2, "0")}`,
    day: day(index % 30),
    amount: 2_000 + (index % 7) * 500,
    categoryName: index % 3 === 0 ? "Food" : "Transport",
    payee: index % 3 === 0 ? "Market Stall" : "Boda Rider",
  }),
);

/** A payment and the fee charged against it, linked by feeParentId. */
export const PAYMENT_WITH_FEE = transaction({
  id: "e2e-tx-with-fee",
  day: TODAY,
  amount: 31_000,
  categoryName: "Airtime",
  payee: "Airtime Top Up",
  note: "SENT.TID 000111222. UGX 31,000 to A PERSON 0700000000. Fee UGX 500. Bal UGX 46,465.",
  accountId: ACCOUNTS.momo.id,
});

export const FEE_ON_PAYMENT: Transaction = {
  ...transaction({
    id: "e2e-tx-fee",
    day: TODAY,
    amount: 500,
    categoryName: "Fees & charges",
    payee: "Airtime Top Up",
    accountId: ACCOUNTS.momo.id,
  }),
  feeParentId: PAYMENT_WITH_FEE.id,
  note: "Fee / charges",
};

/** A balanced pair. Deleting either leg must take both. */
const TRANSFER_GROUP = "e2e-transfer-group";
export const TRANSFER_OUT: Transaction = {
  ...transaction({
    id: "e2e-tx-transfer-out",
    day: day(2),
    amount: -150_000,
    categoryName: "Transfers",
    payee: "Own Transfer",
    accountId: ACCOUNTS.bank.id,
    type: "transfer",
  }),
  transferGroupId: TRANSFER_GROUP,
};
export const TRANSFER_IN: Transaction = {
  ...transaction({
    id: "e2e-tx-transfer-in",
    day: day(2),
    amount: 150_000,
    categoryName: "Transfers",
    payee: "Own Transfer",
    accountId: ACCOUNTS.momo.id,
    type: "transfer",
  }),
  transferGroupId: TRANSFER_GROUP,
};

/**
 * A payee the parser left as a whole SMS line. This is what forced the ledger
 * row past the viewport: without min-w-0 the grid item sizes to min-content,
 * and short payees never reproduce it.
 */
export const LONG_PAYEE = transaction({
  id: "e2e-tx-long-payee",
  day: day(1),
  amount: 7_000,
  categoryName: "Transport",
  payee: "A VERY LONG COUNTERPARTY NAME 0700000000. Fee UGX 500. Bal UGX 114,465. Date 08-August-2026 21:04",
  note: "Kept as the parser produced it, unbroken, so the row has a wide min-content width.",
});

export const INCOME = transaction({
  id: "e2e-tx-salary",
  day: day(5),
  amount: -900_000,
  categoryName: "Salary",
  payee: "Employer",
  accountId: ACCOUNTS.bank.id,
  type: "income",
});

export const TRANSACTIONS: Transaction[] = [
  ...ROUTINE,
  PAYMENT_WITH_FEE,
  FEE_ON_PAYMENT,
  LONG_PAYEE,
  TRANSFER_OUT,
  TRANSFER_IN,
  INCOME,
];

const PROFILE: UserProfile = {
  id: USER_ID,
  displayName: "E2E Tester",
  currency: "UGX",
  salaryCycle: "month_end",
  primaryIncomeType: "salary",
  riskComfort: "moderate",
  investmentHorizonMonths: 24,
  createdAt: STAMP,
  updatedAt: STAMP,
};

/** A schema-3 export bundle, the same shape a real backup restores from. */
export function buildLedgerFixture() {
  return {
    exportedAt: STAMP,
    schemaVersion: 3,
    userProfile: PROFILE,
    accounts: Object.values(ACCOUNTS),
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    counterparties: [],
    goals: [],
    budgets: [],
    investmentProfiles: [],
    imports: [],
    syncProfiles: [],
    syncOutbox: [],
  };
}
