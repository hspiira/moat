import { describe, expect, it } from "vitest";

import { applyGoalTransactions, getGoalContributionPlan } from "@/lib/domain/goals";
import type { Goal, Transaction } from "@/lib/types";

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

  it("hydrates goal progress from linked savings contribution transactions", () => {
    const transactions: Transaction[] = [
      {
        id: "tx:saving-1",
        userId: "user:default",
        accountId: "account:savings",
        type: "savings_contribution",
        amount: 150_000,
        occurredOn: "2026-04-04",
        categoryId: "category:savings",
        createdAt: "2026-04-04T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
      },
      {
        id: "tx:saving-2",
        userId: "user:default",
        accountId: "account:savings",
        type: "savings_contribution",
        amount: 100_000,
        occurredOn: "2026-04-06",
        categoryId: "category:savings",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
      {
        id: "tx:other-account",
        userId: "user:default",
        accountId: "account:other",
        type: "savings_contribution",
        amount: 300_000,
        occurredOn: "2026-04-08",
        categoryId: "category:savings",
        createdAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:00.000Z",
      },
    ];

    const hydratedGoal = applyGoalTransactions(goal, transactions);

    expect(hydratedGoal.currentAmount).toBe(250_000);
  });
});
