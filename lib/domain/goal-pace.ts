import { getGoalContributionPlan } from "@/lib/domain/goals";
import {
  isLegacySavingsContribution,
  isSavingsDeposit,
  savingsCategoryIds,
} from "@/lib/domain/savings";
import { currentMonthIso } from "@/lib/today";
import type { Category, Goal, Transaction } from "@/lib/types";

export type GoalPace = {
  goal: Goal;
  requiredMonthly: number;
  contributedThisMonth: number;
  shortfall: number;
  monthsRemaining: number;
};

// A goal with a target and a date is a sinking fund already: what it needs each
// month is the remainder divided by the months left. What was missing is whether
// this month kept up, which is the only part a person can act on now.
export function getGoalPace(params: {
  goals: Goal[];
  transactions: Transaction[];
  categories: Category[];
  now: Date;
}): GoalPace[] {
  const month = currentMonthIso(params.now);
  const savingsIds = savingsCategoryIds(params.categories);

  return params.goals
    .filter((goal) => Boolean(goal.linkedAccountId))
    .map((goal) => {
      const plan = getGoalContributionPlan(goal, params.now);

      // Same rule the goal's own progress uses: the leg that arrives in the
      // linked account, or a contribution recorded before savings became a
      // transfer.
      const contributedThisMonth = params.transactions
        .filter(
          (transaction) =>
            transaction.occurredOn.startsWith(month) &&
            transaction.accountId === goal.linkedAccountId &&
            (isLegacySavingsContribution(transaction) ||
              isSavingsDeposit(transaction, savingsIds)),
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

      const requiredMonthly = Math.round(plan.monthlyContribution);

      return {
        goal,
        requiredMonthly,
        contributedThisMonth,
        shortfall: Math.max(0, requiredMonthly - contributedThisMonth),
        monthsRemaining: plan.monthsRemaining,
      };
    })
    .filter((pace) => pace.requiredMonthly > 0)
    .sort((left, right) => right.shortfall - left.shortfall);
}
