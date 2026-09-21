import { describe, expect, it } from "vitest";

import {
  COVER_BASELINE_MIN_MONTHS,
  getAccessibleReserves,
  getCoverStatus,
  getMonthlySpendBaseline,
} from "@/lib/domain/cover";
import type { Account, AccountType, Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-01-01T00:00:00.000Z";
// Mid-September, so the six complete months behind it are March to August.
const NOW = new Date(2026, 8, 21, 12, 0);

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

function spend(
  occurredOn: string,
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: `tx:${occurredOn}:${amount}:${overrides.type ?? "expense"}`,
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

// 100,000 spent in each of the six complete months behind September.
const sixSteadyMonths = ["03", "04", "05", "06", "07", "08"].map((month) =>
  spend(`2026-${month}-10`, 100_000),
);

describe("getAccessibleReserves", () => {
  it("counts only balances that could be spent", () => {
    const reserves = getAccessibleReserves([
      account("cash", 50_000),
      account("mobile_money", 150_000),
      account("bank", 200_000),
      account("sacco", 1_200_000),
      account("investment", 900_000),
      account("receivable", 250_000),
      account("debt", -400_000),
    ]);

    expect(reserves).toBe(400_000);
  });

  it("leaves archived accounts out", () => {
    const reserves = getAccessibleReserves([
      account("cash", 50_000),
      account("bank", 200_000, { isArchived: true }),
    ]);

    expect(reserves).toBe(50_000);
  });
});

describe("getMonthlySpendBaseline", () => {
  it("averages the complete months behind the current one", () => {
    const baseline = getMonthlySpendBaseline(sixSteadyMonths, NOW);

    expect(baseline.monthsMeasured).toBe(6);
    expect(baseline.amount).toBe(100_000);
  });

  // The month in progress is the reason the old figure overstated cover early
  // in the month, so it must not reach the denominator at all.
  it("ignores the month in progress", () => {
    const baseline = getMonthlySpendBaseline(
      [...sixSteadyMonths, spend("2026-09-02", 5_000_000)],
      NOW,
    );

    expect(baseline.amount).toBe(100_000);
  });

  it("divides by the months the user was actually here for", () => {
    const baseline = getMonthlySpendBaseline(
      [spend("2026-07-10", 100_000), spend("2026-08-10", 200_000)],
      NOW,
    );

    expect(baseline.monthsMeasured).toBe(2);
    expect(baseline.amount).toBe(150_000);
  });

  it("counts a complete month with no spending as a real zero", () => {
    const baseline = getMonthlySpendBaseline(
      [spend("2026-07-10", 100_000), spend("2026-08-10", 0, { type: "income", amount: 500_000 })],
      NOW,
    );

    expect(baseline.monthsMeasured).toBe(2);
    expect(baseline.amount).toBe(50_000);
  });

  it("leaves transfers and savings out of spending", () => {
    const baseline = getMonthlySpendBaseline(
      [
        ...sixSteadyMonths,
        spend("2026-07-11", 900_000, { type: "transfer" }),
        spend("2026-07-12", 800_000, { type: "savings_contribution" }),
      ],
      NOW,
    );

    expect(baseline.amount).toBe(100_000);
  });

  it("reports nothing measured when there is no history", () => {
    expect(getMonthlySpendBaseline([], NOW)).toEqual({ amount: 0, monthsMeasured: 0 });
  });
});

describe("getCoverStatus", () => {
  it("divides accessible reserves by a monthly baseline", () => {
    const status = getCoverStatus({
      accounts: [account("cash", 300_000), account("sacco", 5_000_000)],
      transactions: sixSteadyMonths,
      now: NOW,
    });

    expect(status.reserves).toBe(300_000);
    expect(status.monthlySpend).toBe(100_000);
    expect(status.months).toBe(3);
    expect(status.basis).toContain("6 complete months");
  });

  // The whole point of the correction: the answer is a property of the data,
  // not of whichever chip the dashboard happens to have selected.
  it("gives the same answer whatever the dashboard is filtered to", () => {
    const first = getCoverStatus({
      accounts: [account("bank", 600_000)],
      transactions: sixSteadyMonths,
      now: NOW,
    });
    const second = getCoverStatus({
      accounts: [account("bank", 600_000)],
      transactions: [...sixSteadyMonths].reverse(),
      now: NOW,
    });

    expect(first.months).toBe(6);
    expect(second.months).toBe(first.months);
  });

  it("says it cannot tell yet rather than guessing from one month", () => {
    const status = getCoverStatus({
      accounts: [account("cash", 500_000)],
      transactions: [spend("2026-08-10", 100_000)],
      now: NOW,
    });

    expect(status.monthsMeasured).toBeLessThan(COVER_BASELINE_MIN_MONTHS);
    expect(status.months).toBeNull();
    expect(status.monthlySpend).toBe(0);
    expect(status.basis).toContain("complete months");
  });

  it("reads an emptied account as no cover, not as unknown cover", () => {
    const status = getCoverStatus({
      accounts: [account("cash", 0)],
      transactions: sixSteadyMonths,
      now: NOW,
    });

    expect(status.months).toBe(0);
  });
});
