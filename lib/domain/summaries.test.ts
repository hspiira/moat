import { describe, expect, it } from "vitest";

import { getMonthSummary, getSavingsRate } from "@/lib/domain/summaries";
import type { Category, Transaction } from "@/lib/types";

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
  {
    id: "tx:salary",
    userId: "user:default",
    accountId: "account:bank",
    type: "income",
    amount: 2_000_000,
    occurredOn: "2026-04-01",
    categoryId: "category:salary",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "tx:food",
    userId: "user:default",
    accountId: "account:wallet",
    type: "expense",
    amount: 300_000,
    occurredOn: "2026-04-03",
    categoryId: "category:food",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
  {
    id: "tx:savings",
    userId: "user:default",
    accountId: "account:sacco",
    type: "savings_contribution",
    amount: 400_000,
    occurredOn: "2026-04-04",
    categoryId: "category:savings",
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  },
  {
    id: "tx:transfer-out",
    userId: "user:default",
    accountId: "account:wallet",
    type: "transfer",
    amount: -100_000,
    occurredOn: "2026-04-05",
    categoryId: "category:transfers",
    transferGroupId: "transfer:1",
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z",
  },
  {
    id: "tx:transfer-in",
    userId: "user:default",
    accountId: "account:bank",
    type: "transfer",
    amount: 100_000,
    occurredOn: "2026-04-05",
    categoryId: "category:transfers",
    transferGroupId: "transfer:1",
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z",
  },
];

describe("getMonthSummary", () => {
  it("separates inflow, outflow, savings, and ignores transfers in cash-flow totals", () => {
    const summary = getMonthSummary(transactions, categories, "2026-04");

    expect(summary.inflow).toBe(2_000_000);
    expect(summary.outflow).toBe(300_000);
    expect(summary.savings).toBe(400_000);
    expect(summary.transfers).toBe(0);
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

    expect(getSavingsRate(summary)).toBe(0.2);
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
    expect(summary.savings).toBe(400_000);
  });
});
