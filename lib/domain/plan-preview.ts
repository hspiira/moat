import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { RecurringEvaluation } from "@/lib/domain/recurring";

// What the monthly plan would tell you, in one line, so Home can point at it
// without reproducing it. Overdue sorts ahead of upcoming: a bill you have
// already missed is the one worth naming.
export type PlanPreview = {
  nextBill: { name: string; daysLeft: number } | null;
  billsOutstanding: number;
  outstandingAmount: number;
  hasBills: boolean;
  overspentBudgets: number;
  hasPlan: boolean;
};

export function getPlanPreview(params: {
  evaluations: RecurringEvaluation[];
  envelopes: BudgetEnvelope[];
  today: Date;
}): PlanPreview {
  const dayOfMonth = params.today.getDate();

  const unpaid = params.evaluations.filter((evaluation) => evaluation.state !== "paid");
  const dated = unpaid
    .filter((evaluation) => Boolean(evaluation.obligation.dueDay))
    .map((evaluation) => ({
      name: evaluation.obligation.name,
      daysLeft: (evaluation.obligation.dueDay ?? 0) - dayOfMonth,
    }))
    .sort((left, right) => left.daysLeft - right.daysLeft);

  return {
    nextBill: dated[0] ?? null,
    billsOutstanding: unpaid.length,
    outstandingAmount: unpaid.reduce((sum, bill) => sum + Math.max(0, bill.expectedAmount - bill.matchedAmount), 0),
    hasBills: params.evaluations.length > 0,
    overspentBudgets: params.envelopes.filter((envelope) => envelope.isOverspent).length,
    hasPlan: params.evaluations.length > 0 || params.envelopes.length > 0,
  };
}

export function describeBillTiming(daysLeft: number): string {
  if (daysLeft < -1) return `${Math.abs(daysLeft)} days overdue`;
  if (daysLeft === -1) return "1 day overdue";
  if (daysLeft === 0) return "due today";
  if (daysLeft === 1) return "due tomorrow";
  return `due in ${daysLeft} days`;
}
