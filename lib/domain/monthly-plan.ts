import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { RecurringEvaluation } from "@/lib/domain/recurring";

export type MonthlyPlanSummary = {
  /** Allocated across every budget, whether spent yet or not. */
  budgeted: number;
  /** Still to pay on bills that repeat. */
  billsOutstanding: number;
  /**
   * The part of that which no budget already covers. A bill filed under a
   * budgeted category is money the budget has already claimed, so counting
   * both would overstate the month.
   */
  billsOutsideBudgets: number;
  /** What the month has claimed on income: budgets plus uncovered bills. */
  spokenFor: number;
  income: number;
  /** What income is left over. Negative when the plan outruns the money. */
  unspokenFor: number;
  overcommitted: boolean;
};

function outstandingOf(evaluation: RecurringEvaluation): number {
  if (evaluation.state === "paid") return 0;
  return Math.max(0, evaluation.expectedAmount - evaluation.matchedAmount);
}

/**
 * One figure for what a month is committed to, from the two halves of the plan.
 * Bills and budgets overlap by design, so the overlap is removed rather than
 * added twice.
 */
export function summariseMonthlyPlan(params: {
  envelopes: BudgetEnvelope[];
  evaluations: RecurringEvaluation[];
  income: number;
}): MonthlyPlanSummary {
  const budgeted = params.envelopes.reduce(
    (total, envelope) => total + envelope.allocated + envelope.rollover,
    0,
  );
  const budgetedCategories = new Set(params.envelopes.map((envelope) => envelope.categoryId));

  let billsOutstanding = 0;
  let billsOutsideBudgets = 0;

  for (const evaluation of params.evaluations) {
    const outstanding = outstandingOf(evaluation);
    if (outstanding === 0) continue;

    billsOutstanding += outstanding;
    if (!budgetedCategories.has(evaluation.obligation.categoryId)) {
      billsOutsideBudgets += outstanding;
    }
  }

  const spokenFor = budgeted + billsOutsideBudgets;

  return {
    budgeted,
    billsOutstanding,
    billsOutsideBudgets,
    spokenFor,
    income: params.income,
    unspokenFor: params.income - spokenFor,
    overcommitted: params.income > 0 && spokenFor > params.income,
  };
}
