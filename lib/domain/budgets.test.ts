import { describe, expect, it } from "vitest";

import { getBudgetCoverage, getBudgetEnvelopes, getBudgetFundingCapacity } from "@/lib/domain/budgets";
import type { BudgetTarget, Category, Transaction } from "@/lib/types";

const categories: Category[] = [
  { id: "cat:rent", userId: "user:1", name: "Rent", kind: "expense", isDefault: true, createdAt: "2026-04-01T00:00:00.000Z" },
  { id: "cat:salary", userId: "user:1", name: "Salary", kind: "income", isDefault: true, createdAt: "2026-04-01T00:00:00.000Z" },
];

const budgets: BudgetTarget[] = [
  {
    id: "budget:rent",
    userId: "user:1",
    month: "2026-04",
    categoryId: "cat:rent",
    targetAmount: 500000,
    rolloverAmount: 20000,
    incomeTransactionId: "tx:income",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "tx:income",
    userId: "user:1",
    accountId: "account:bank",
    type: "income",
    amount: 1500000,
    currency: "UGX",
    originalAmount: 1500000,
    occurredOn: "2026-04-02",
    categoryId: "cat:salary",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  },
  {
    id: "tx:rent",
    userId: "user:1",
    accountId: "account:bank",
    type: "expense",
    amount: 300000,
    currency: "UGX",
    originalAmount: 300000,
    occurredOn: "2026-04-03",
    categoryId: "cat:rent",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
];

describe("budget domain", () => {
  it("builds envelopes with funding metadata", () => {
    const envelopes = getBudgetEnvelopes(budgets, categories, transactions);

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]).toMatchObject({
      budgetId: "budget:rent",
      categoryId: "cat:rent",
      allocated: 520000,
      spent: 300000,
      remaining: 220000,
      incomeTransactionId: "tx:income",
    });
  });

  it("computes coverage and unallocated income", () => {
    expect(getBudgetCoverage(budgets, transactions)).toEqual({
      allocated: 520000,
      spent: 300000,
      remaining: 220000,
    });

    expect(getBudgetFundingCapacity(budgets, transactions)).toEqual({
      inflow: 1500000,
      allocated: 520000,
      unallocatedIncome: 980000,
    });
  });
});
