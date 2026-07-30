// Groups recurring bills by what they need from you, and works out whether one
// is overdue.
//
// The old list was flat and rendered `evaluation.state` verbatim, so a row read
// "… · missing". It also showed only evaluated bills, and evaluation covers
// active ones only — so pausing a bill removed it from the screen along with the
// Resume button that was its only way back.

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

/** `today` is passed in rather than read from the clock, so this stays pure. */
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
    // The due day itself is not yet late.
    isOverdue: Number.isFinite(dayOfMonth) && dayOfMonth > dueDay,
    label: `Due ${ordinal(dueDay)}`,
  };
}

export type OutstandingBill = {
  evaluation: RecurringEvaluation;
  obligation: RecurringEvaluation["obligation"];
  due: BillDueState;
  /** Expected minus matched, floored at zero. */
  stillOwed: number;
};

export type RecurringSections = {
  outstanding: OutstandingBill[];
  paid: OutstandingBill[];
  paused: RecurringObligation[];
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

  const outstanding = described
    .filter((entry) => entry.evaluation.state !== "paid")
    // Overdue first: those are the ones already costing you something.
    .sort((a, b) => {
      const byOverdue = Number(b.due.isOverdue) - Number(a.due.isOverdue);
      if (byOverdue !== 0) return byOverdue;
      return (a.due.dueDay ?? 99) - (b.due.dueDay ?? 99);
    });

  return {
    outstanding,
    paid: described.filter((entry) => entry.evaluation.state === "paid"),
    paused: obligations.filter((obligation) => obligation.status !== "active"),
    outstandingTotal: outstanding.reduce((sum, entry) => sum + entry.stillOwed, 0),
  };
}
