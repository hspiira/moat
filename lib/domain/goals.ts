import type { Goal, GoalContributionPlan, Transaction } from "@/lib/types";

/**
 * Goal progress is derived, not stored: `goal.currentAmount` is the manual
 * starting amount, and savings contributions recorded against the goal's
 * linked account accrue on top of it. Goals without a linked account fall
 * back to the manually entered amount.
 */
export function deriveGoalCurrentAmount(goal: Goal, transactions: Transaction[]): number {
  if (!goal.linkedAccountId) {
    return goal.currentAmount;
  }

  const contributed = transactions
    .filter(
      (transaction) =>
        transaction.type === "savings_contribution" &&
        transaction.accountId === goal.linkedAccountId,
    )
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return goal.currentAmount + contributed;
}

export function withDerivedGoalProgress(goals: Goal[], transactions: Transaction[]): Goal[] {
  return goals.map((goal) => ({
    ...goal,
    currentAmount: deriveGoalCurrentAmount(goal, transactions),
  }));
}

function differenceInMonths(targetDate: string, referenceDate: Date): number {
  const target = new Date(targetDate);
  const months =
    (target.getUTCFullYear() - referenceDate.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - referenceDate.getUTCMonth());

  return Math.max(months + 1, 1);
}

export function getGoalContributionPlan(
  goal: Goal,
  referenceDate: Date = new Date(),
): GoalContributionPlan {
  const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const monthsRemaining = differenceInMonths(goal.targetDate, referenceDate);
  const monthlyContribution =
    monthsRemaining === 0 ? remainingAmount : remainingAmount / monthsRemaining;

  return {
    goalId: goal.id,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remainingAmount,
    monthsRemaining,
    monthlyContribution,
    isBehindSchedule: remainingAmount > 0 && monthsRemaining <= 1,
  };
}
