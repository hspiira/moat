import { describe, expect, it } from "vitest";

import { getGoalContributionPlan } from "@/lib/domain/goals";
import type { Goal } from "@/lib/types";

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
