// Turns a month-close evaluation into the list of things standing between you
// and a closed month — carrying the underlying records, not just counts.
//
// The old panel showed "3 records look the same" with no way to see which three,
// so it told you that you were blocked without offering a route forward.

import type { MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import type { Transaction } from "@/lib/types";

export type UnresolvedEntry = {
  id: string;
  transaction: Transaction;
};

export type DuplicateEntry = {
  id: string;
  transactions: Transaction[];
};

export type ObligationEntry = {
  id: string;
  name: string;
  expectedAmount: number;
  matchedAmount: number;
  state: RecurringEvaluation["state"];
};

export type MonthCloseBlockerGroup =
  | { kind: "unresolved"; label: string; hint: string; count: number; entries: UnresolvedEntry[] }
  | { kind: "duplicate"; label: string; hint: string; count: number; entries: DuplicateEntry[] }
  | { kind: "obligation"; label: string; hint: string; count: number; entries: ObligationEntry[] };

export type MonthCloseBlockers = {
  groups: MonthCloseBlockerGroup[];
  total: number;
};

export function getMonthCloseBlockers({
  evaluation,
  recurringEvaluations,
}: {
  evaluation: MonthCloseEvaluation;
  recurringEvaluations: RecurringEvaluation[];
}): MonthCloseBlockers {
  const groups: MonthCloseBlockerGroup[] = [];

  if (evaluation.unresolvedTransactions.length > 0) {
    groups.push({
      kind: "unresolved",
      label: "Not yet posted",
      hint: "Captured or imported but never confirmed.",
      count: evaluation.unresolvedTransactions.length,
      entries: evaluation.unresolvedTransactions.map((transaction) => ({
        id: transaction.id,
        transaction,
      })),
    });
  }

  if (evaluation.duplicateGroups.length > 0) {
    groups.push({
      kind: "duplicate",
      label: "Possibly duplicated",
      hint: "Records that look like the same money twice.",
      count: evaluation.duplicateGroups.length,
      entries: evaluation.duplicateGroups.map((group) => ({
        id: group.key,
        transactions: group.transactions,
      })),
    });
  }

  const unpaid = recurringEvaluations.filter((entry) => entry.state !== "paid");
  if (unpaid.length > 0) {
    groups.push({
      kind: "obligation",
      label: "Bills not seen",
      hint: "Expected this month, no matching payment found.",
      count: unpaid.length,
      entries: unpaid.map((entry) => ({
        id: entry.obligation.id,
        name: entry.obligation.name,
        expectedAmount: entry.expectedAmount,
        matchedAmount: entry.matchedAmount,
        state: entry.state,
      })),
    });
  }

  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.count, 0),
  };
}
