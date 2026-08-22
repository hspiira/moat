import type { RecurringEvaluation } from "@/lib/domain/recurring";
import type { RecurringObligation } from "@/lib/types";

export type BillDueState = {
  dueDay: number | null;
  isOverdue: boolean;
  label: string | null;
};

function ordinal(day: number) {
  const remainderTen = day % 10;
  const remainderHundred = day % 100;
  if (remainderTen === 1 && remainderHundred !== 11) return `${day}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${day}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${day}rd`;
  return `${day}th`;
}

export function getBillDueState(
  obligation: Pick<RecurringObligation, "dueDay">,
  today: string,
): BillDueState {
  const dueDay = obligation.dueDay ?? null;
  if (dueDay === null) {
    return { dueDay: null, isOverdue: false, label: null };
  }

  const dayOfMonth = Number(today.slice(8, 10));
  return {
    dueDay,
    isOverdue: Number.isFinite(dayOfMonth) && dayOfMonth > dueDay,
    label: `Due ${ordinal(dueDay)}`,
  };
}

export type OutstandingBill = {
  evaluation: RecurringEvaluation;
  obligation: RecurringEvaluation["obligation"];
  due: BillDueState;
  stillOwed: number;
};

export type RecurringSections = {
  outstanding: OutstandingBill[];
  paid: OutstandingBill[];
  paused: RecurringObligation[];
  offSchedule: RecurringObligation[];
  outstandingTotal: number;
};

export function getRecurringSections({
  evaluations,
  obligations,
  today,
}: {
  evaluations: RecurringEvaluation[];
  obligations: RecurringObligation[];
  today: string;
}): RecurringSections {
  const describe = (evaluation: RecurringEvaluation): OutstandingBill => ({
    evaluation,
    obligation: evaluation.obligation,
    due: getBillDueState(evaluation.obligation, today),
    stillOwed: Math.max(0, evaluation.expectedAmount - evaluation.matchedAmount),
  });

  const described = evaluations.map(describe);
  const evaluated = new Set(evaluations.map((entry) => entry.obligation.id));

  const outstanding = described
    .filter((entry) => entry.evaluation.state !== "paid")
    .sort((a, b) => {
      const byOverdue = Number(b.due.isOverdue) - Number(a.due.isOverdue);
      if (byOverdue !== 0) return byOverdue;
      return (a.due.dueDay ?? 99) - (b.due.dueDay ?? 99);
    });

  return {
    outstanding,
    paid: described.filter((entry) => entry.evaluation.state === "paid"),
    paused: obligations.filter((obligation) => obligation.status !== "active"),
    // An active bill outside its start/end months gets no evaluation, so list it
    // here or it disappears from the page altogether.
    offSchedule: obligations.filter(
      (obligation) => obligation.status === "active" && !evaluated.has(obligation.id),
    ),
    outstandingTotal: outstanding.reduce((sum, entry) => sum + entry.stillOwed, 0),
  };
}
