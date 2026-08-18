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
      label: "Not confirmed yet",
      hint: "Read from a message or import. You have not checked them.",
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
      label: "Might be recorded twice",
      hint: "These look like the same money entered more than once.",
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
      label: "Bills with no payment",
      hint: "You expected these this month. Nothing matching was found.",
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

export type MonthCloseCheck = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
};

/**
 * Every check the month runs, passed or not. "Everything looks complete" on its
 * own asks to be trusted; the list is what earns it.
 */
export function getMonthCloseChecks({
  evaluation,
  recurringEvaluations,
}: {
  evaluation: MonthCloseEvaluation;
  recurringEvaluations: RecurringEvaluation[];
}): MonthCloseCheck[] {
  const unpaid = recurringEvaluations.filter((entry) => entry.state !== "paid").length;
  const expected = recurringEvaluations.length;

  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  return [
    {
      id: "unresolved",
      label: "Everything confirmed",
      detail:
        evaluation.unresolvedTransactions.length === 0
          ? "Nothing is waiting on you"
          : `${count(evaluation.unresolvedTransactions.length, "record", "records")} still unconfirmed`,
      passed: evaluation.unresolvedTransactions.length === 0,
    },
    {
      id: "duplicate",
      label: "No duplicates",
      detail:
        evaluation.duplicateGroups.length === 0
          ? "No money looks recorded twice"
          : `${count(evaluation.duplicateGroups.length, "pair", "pairs")} look the same`,
      passed: evaluation.duplicateGroups.length === 0,
    },
    {
      id: "categorised",
      label: "Everything filed",
      detail:
        evaluation.missingCategoryTransactions.length === 0
          ? "Every transaction has a category"
          : `${count(evaluation.missingCategoryTransactions.length, "transaction", "transactions")} without a category`,
      passed: evaluation.missingCategoryTransactions.length === 0,
    },
    {
      id: "obligations",
      label: "Bills accounted for",
      detail:
        expected === 0
          ? "No recurring bills set up"
          : unpaid === 0
            ? `All ${expected} seen this month`
            : `${unpaid} of ${expected} with no payment`,
      passed: unpaid === 0,
    },
  ];
}
