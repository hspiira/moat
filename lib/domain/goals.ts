import type { Goal, GoalContributionPlan } from "@/lib/types";

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
