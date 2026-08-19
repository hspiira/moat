import { describe, expect, it } from "vitest";

import {
  deriveGoalCurrentAmount,
  getGoalContributionPlan,
  withDerivedGoalProgress,
} from "@/lib/domain/goals";
import type { Category, Goal, Transaction } from "@/lib/types";

const SAVINGS_CATEGORIES: Category[] = [
  {
    id: "category:savings",
    userId: "user:default",
    name: "Savings",
    kind: "savings",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
];

function buildTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: `txn:${Math.random().toString(36).slice(2)}`,
    userId: "user:default",
    accountId: "account:savings",
    type: "savings_contribution",
    amount: 100_000,
    currency: "UGX",
    originalAmount: 100_000,
    occurredOn: "2026-04-10",
    categoryId: "category:savings",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

const goal: Goal = {
  id: "goal:emergency",
  userId: "user:default",
  name: "Emergency fund",
  goalType: "emergency_fund",
  targetAmount: 1_200_000,
  currentAmount: 0,
  targetDate: "2026-09-30",
  priority: 1,
  linkedAccountId: "account:savings",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

describe("goal domain rules", () => {
  it("builds a monthly contribution plan from remaining balance and months left", () => {
    const plan = getGoalContributionPlan(goal, new Date("2026-04-15T00:00:00.000Z"));

    expect(plan.remainingAmount).toBe(1_200_000);
    expect(plan.monthsRemaining).toBe(6);
    expect(plan.monthlyContribution).toBe(200_000);
  });

  it("builds a plan from explicit saved progress instead of inferring cross-goal allocations", () => {
    const plan = getGoalContributionPlan(
      { ...goal, currentAmount: 300_000 },
      new Date("2026-04-15T00:00:00.000Z"),
    );

    expect(plan.remainingAmount).toBe(900_000);
    expect(plan.monthlyContribution).toBe(150_000);
  });
});

describe("derived goal progress", () => {
  it("adds savings contributions on the linked account to the starting amount", () => {
    const transactions = [
      buildTransaction({ amount: 100_000 }),
      buildTransaction({ amount: 250_000 }),
    ];

    expect(deriveGoalCurrentAmount({ ...goal, currentAmount: 50_000 }, transactions)).toBe(
      400_000,
    );
  });

  it("ignores contributions on other accounts and non-savings transactions", () => {
    const transactions = [
      buildTransaction({ accountId: "account:other" }),
      buildTransaction({ type: "expense" }),
      buildTransaction({ type: "income" }),
      buildTransaction({ amount: 75_000 }),
    ];

    expect(deriveGoalCurrentAmount(goal, transactions)).toBe(75_000);
  });

  it("falls back to the manually entered amount when no account is linked", () => {
    const unlinkedGoal = { ...goal, linkedAccountId: undefined, currentAmount: 500_000 };

    expect(deriveGoalCurrentAmount(unlinkedGoal, [buildTransaction({})])).toBe(500_000);
  });

  it("counts the leg that arrives in the linked account", () => {
    const transactions = [
      buildTransaction({
        id: "tx:out",
        accountId: "account:bank",
        type: "transfer",
        amount: -120_000,
        transferGroupId: "g1",
      }),
      buildTransaction({
        id: "tx:in",
        accountId: "account:savings",
        type: "transfer",
        amount: 120_000,
        transferGroupId: "g1",
      }),
    ];

    expect(
      deriveGoalCurrentAmount({ ...goal, currentAmount: 0 }, transactions, SAVINGS_CATEGORIES),
    ).toBe(120_000);
  });

  it("leaves an ordinary transfer into the linked account out of goal progress", () => {
    const transactions = [
      buildTransaction({
        accountId: "account:savings",
        type: "transfer",
        amount: 90_000,
        categoryId: "category:transfers",
      }),
    ];

    expect(
      deriveGoalCurrentAmount({ ...goal, currentAmount: 0 }, transactions, SAVINGS_CATEGORIES),
    ).toBe(0);
  });

  it("maps a goal list without mutating stored goals", () => {
    const stored = [{ ...goal, currentAmount: 0 }];
    const derived = withDerivedGoalProgress(stored, [buildTransaction({ amount: 20_000 })]);

    expect(derived[0].currentAmount).toBe(20_000);
    expect(stored[0].currentAmount).toBe(0);
  });
});
