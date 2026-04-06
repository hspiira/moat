import { describe, expect, it } from "vitest";

import { getMonthSummary, getSavingsRate } from "@/lib/domain/summaries";
import type { Category, Transaction } from "@/lib/types";

function buildTransaction(
  values: Partial<Transaction> & Pick<Transaction, "id" | "accountId" | "type" | "amount" | "occurredOn" | "categoryId">,
): Transaction {
  return {
    userId: "user:default",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...values,
  };
}

const categories: Category[] = [
  {
    id: "category:food",
    userId: "user:default",
    name: "Food",
    kind: "expense",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "category:salary",
    userId: "user:default",
    name: "Salary",
    kind: "income",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "category:savings",
    userId: "user:default",
    name: "Savings",
    kind: "savings",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "category:transfers",
    userId: "user:default",
    name: "Transfers",
    kind: "transfer",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  buildTransaction({
    id: "tx:salary",
    accountId: "account:bank",
    type: "income",
    amount: 2_000_000,
    occurredOn: "2026-04-01",
    categoryId: "category:salary",
  }),
  buildTransaction({
    id: "tx:food",
    accountId: "account:wallet",
    type: "expense",
    amount: 300_000,
    occurredOn: "2026-04-03",
    categoryId: "category:food",
  }),
  buildTransaction({
    id: "tx:savings",
    accountId: "account:sacco",
    type: "savings_contribution",
    amount: 400_000,
    occurredOn: "2026-04-04",
    categoryId: "category:savings",
  }),
  buildTransaction({
    id: "tx:transfer-out",
    accountId: "account:wallet",
    type: "transfer",
    amount: -100_000,
    occurredOn: "2026-04-05",
    categoryId: "category:transfers",
    transferGroupId: "transfer:1",
  }),
  buildTransaction({
    id: "tx:transfer-in",
    accountId: "account:bank",
    type: "transfer",
    amount: 100_000,
    occurredOn: "2026-04-05",
    categoryId: "category:transfers",
    transferGroupId: "transfer:1",
  }),
];

describe("getMonthSummary", () => {
  it("separates inflow, outflow, saved surplus, allocated savings, and ignores transfers in cash-flow totals", () => {
    const summary = getMonthSummary(transactions, categories, "2026-04");

    expect(summary.inflow).toBe(2_000_000);
    expect(summary.outflow).toBe(300_000);
    expect(summary.savings).toBe(1_700_000);
    expect(summary.allocatedSavings).toBe(400_000);
    expect(summary.transfers).toBe(0);
    expect(summary.movement).toBe(1_300_000);
    expect(summary.closingBalance).toBe(1_300_000);
    expect(summary.topCategories).toEqual([
      {
        categoryId: "category:food",
        categoryName: "Food",
        amount: 300_000,
      },
    ]);
  });

  it("calculates savings rate from monthly inflow", () => {
    const summary = getMonthSummary(transactions, categories, "2026-04");

    expect(getSavingsRate(summary)).toBe(0.85);
  });

  it("applies opening balance to the closing balance bridge", () => {
    const summary = getMonthSummary(transactions, categories, "2026-04");

    const withOpening = {
      ...summary,
      openingBalance: 500_000,
      closingBalance: 500_000 + summary.movement,
    };

    expect(withOpening.openingBalance + withOpening.movement).toBe(withOpening.closingBalance);
  });

  it("uses absolute magnitudes for non-transfer totals", () => {
    const summary = getMonthSummary(
      [
        {
          ...transactions[0],
          id: "tx:negative-income",
          amount: -2_000_000,
        },
        {
          ...transactions[1],
          id: "tx:negative-expense",
          amount: -300_000,
        },
        {
          ...transactions[2],
          id: "tx:negative-savings",
          amount: -400_000,
        },
      ],
      categories,
      "2026-04",
    );

    expect(summary.inflow).toBe(2_000_000);
    expect(summary.outflow).toBe(300_000);
    expect(summary.savings).toBe(1_700_000);
    expect(summary.allocatedSavings).toBe(400_000);
  });
});
