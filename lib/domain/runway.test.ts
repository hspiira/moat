import { describe, expect, it } from "vitest";

import { getRunway } from "@/lib/domain/runway";
import type { Account, AccountType, Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";
const NOW = new Date(2026, 7, 20, 12, 0);

function account(type: AccountType, balance: number, overrides: Partial<Account> = {}): Account {
  return {
    id: `acc:${type}:${balance}`,
    userId: USER,
    name: type,
    type,
    openingBalance: balance,
    balance,
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function spend(occurredOn: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx:${occurredOn}:${amount}`,
    userId: USER,
    accountId: "acc:cash:0",
    type: "expense",
    amount,
    currency: "UGX",
    originalAmount: amount,
    occurredOn,
    categoryId: "cat:food",
    reconciliationState: "posted",
    source: "manual",
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
    ...overrides,
  };
}

// 20 days of history at 10,000 a day.
const steady = Array.from({ length: 20 }, (_, index) =>
  spend(`2026-08-${String(index + 1).padStart(2, "0")}`, 10_000),
);

describe("getRunway", () => {
  it("counts only what could be spent this week", () => {
    const runway = getRunway({
      accounts: [
        account("cash", 50_000),
        account("mobile_money", 150_000),
        account("bank", 200_000),
        account("sacco", 1_200_000),
        account("investment", 900_000),
        account("receivable", 250_000),
      ],
      transactions: steady,
      now: NOW,
    });

    expect(runway.liquid).toBe(400_000);
  });

  it("divides by the history that exists, not the window asked for", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: steady,
      now: NOW,
      lookbackDays: 30,
    });

    // 20 days of entries, 200,000 spent, so 10,000 a day rather than 6,667.
    expect(runway.daysMeasured).toBe(20);
    expect(runway.dailyBurn).toBe(10_000);
  });

  it("says how many days are left and the date it runs out", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: steady,
      now: NOW,
    });

    expect(runway.daysCovered).toBe(40);
    expect(runway.runsOutOn).toBe("2026-09-29");
  });

  it("ignores transfers, which move money rather than spend it", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: [
        ...steady,
        spend("2026-08-19", -500_000, { type: "transfer", transferGroupId: "g" }),
      ],
      now: NOW,
    });

    expect(runway.dailyBurn).toBe(10_000);
  });

  it("counts a charge, which is money gone like any other", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: [...steady, spend("2026-08-20", 20_000, { feeParentId: "x" })],
      now: NOW,
    });

    expect(runway.dailyBurn).toBe(11_000);
  });

  it("has no opinion when nothing has been spent", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: [],
      now: NOW,
    });

    expect(runway.dailyBurn).toBe(0);
    expect(runway.daysCovered).toBeNull();
    expect(runway.runsOutOn).toBeNull();
  });

  it("reports nothing left rather than a negative runway", () => {
    const runway = getRunway({
      accounts: [account("cash", -5_000)],
      transactions: steady,
      now: NOW,
    });

    expect(runway.daysCovered).toBe(0);
    expect(runway.runsOutOn).toBe("2026-08-20");
  });

  it("leaves out spending older than the window", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000)],
      transactions: [...steady, spend("2026-05-01", 900_000)],
      now: NOW,
      lookbackDays: 30,
    });

    expect(runway.dailyBurn).toBe(10_000);
  });

  it("leaves an archived account out of what is spendable", () => {
    const runway = getRunway({
      accounts: [account("cash", 400_000), account("bank", 999_000, { isArchived: true })],
      transactions: steady,
      now: NOW,
    });

    expect(runway.liquid).toBe(400_000);
  });
});
