import { describe, expect, it } from "vitest";

import { findMoneyDrift, hasMoneyDrift } from "@/lib/domain/money-drift";
import type { Account, BudgetTarget, Goal, Transaction } from "@/lib/types";

const STAMP = "2026-08-18T00:00:00.000Z";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  userId: "u1",
  accountId: "a1",
  type: "expense",
  amount: 5_000,
  currency: "UGX",
  originalAmount: 5_000,
  occurredOn: "2026-08-01",
  categoryId: "c1",
  reconciliationState: "posted",
  source: "manual",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "a1",
  userId: "u1",
  name: "Momo",
  type: "mobile_money",
  openingBalance: 0,
  balance: 0,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...overrides,
});

const plan = (input: {
  transactions?: Transaction[];
  accounts?: Account[];
  goals?: Goal[];
  budgets?: BudgetTarget[];
}) =>
  findMoneyDrift({
    transactions: input.transactions ?? [],
    accounts: input.accounts ?? [],
    goals: input.goals ?? [],
    budgets: input.budgets ?? [],
    timestamp: STAMP,
  });

describe("findMoneyDrift", () => {
  it("leaves a clean ledger alone", () => {
    const result = plan({ transactions: [transaction()], accounts: [account()] });
    expect(hasMoneyDrift(result)).toBe(false);
    expect(result.transactions).toEqual([]);
    expect(result.accounts).toEqual([]);
  });

  it("rounds the shillings an FX conversion left fractional", () => {
    const result = plan({
      transactions: [transaction({ amount: 22174.000000164, originalAmount: 22174.000000164 })],
    });
    expect(result.transactions[0].amount).toBe(22174);
    expect(result.transactions[0].originalAmount).toBe(22174);
    expect(result.corrections).toHaveLength(2);
  });

  it("repairs both an opening balance and a drifted balance", () => {
    const result = plan({
      accounts: [account({ openingBalance: 1110.19, balance: 69056.189999836 })],
    });
    expect(result.accounts[0].openingBalance).toBe(1110);
    expect(result.accounts[0].balance).toBe(69056);
  });

  it("keeps the cents on a foreign original, and rounds only the shillings", () => {
    const result = plan({
      transactions: [
        transaction({ currency: "USD", originalAmount: 12.34, amount: 45664.17, fxRateToUgx: 3700.5 }),
      ],
    });
    expect(result.transactions[0].originalAmount).toBe(12.34);
    expect(result.transactions[0].amount).toBe(45664);
  });

  it("stamps updatedAt so the change reaches the sync outbox", () => {
    const result = plan({ transactions: [transaction({ amount: 1.5 })] });
    expect(result.transactions[0].updatedAt).toBe(STAMP);
  });

  it("does not invent a value for an absent optional field", () => {
    const result = plan({ accounts: [account({ debtPrincipal: undefined, balance: 0.5 })] });
    expect(result.accounts[0].debtPrincipal).toBeUndefined();
    expect(result.corrections.map((entry) => entry.field)).toEqual(["balance"]);
  });

  it("reports what it changed", () => {
    const result = plan({ accounts: [account({ balance: 69056.189999836 })] });
    expect(result.corrections[0]).toEqual({
      store: "accounts",
      id: "a1",
      field: "balance",
      from: 69056.189999836,
      to: 69056,
    });
  });

  it("rounds half away from zero", () => {
    const result = plan({ transactions: [transaction({ amount: 2.5, originalAmount: 2.5 })] });
    expect(result.transactions[0].amount).toBe(3);
  });
});
