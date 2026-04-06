import type {
  Category,
  MonthClose,
  RecurringObligation,
  Transaction,
} from "@/lib/types";

export type DuplicateGroup = {
  key: string;
  transactions: Transaction[];
};

export type MonthCloseEvaluation = {
  unresolvedTransactions: Transaction[];
  duplicateGroups: DuplicateGroup[];
  missingCategoryTransactions: Transaction[];
  recurringDueCount: number;
  recurringMissingCount: number;
  isReadyToClose: boolean;
};

export function getUnresolvedTransactions(transactions: Transaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.reconciliationState === "draft" ||
      transaction.reconciliationState === "parsed",
  );
}

function getDuplicateKey(transaction: Transaction) {
  if (transaction.messageHash) {
    return `hash:${transaction.messageHash}`;
  }

  return [
    transaction.accountId,
    transaction.occurredOn,
    transaction.type,
    Math.abs(transaction.amount),
    transaction.note ?? "",
  ].join("|");
}

export function getDuplicateGroups(transactions: Transaction[]): DuplicateGroup[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const key = getDuplicateKey(transaction);
    const nextGroup = groups.get(key) ?? [];
    nextGroup.push(transaction);
    groups.set(key, nextGroup);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, transactions: items }));
}

export function getMissingCategoryTransactions(
  transactions: Transaction[],
  categories: Category[],
) {
  const categoryIds = new Set(categories.map((category) => category.id));
  return transactions.filter((transaction) => !categoryIds.has(transaction.categoryId));
}

export function evaluateMonthClose(
  periodTransactions: Transaction[],
  categories: Category[],
  obligations: Array<{ obligation: RecurringObligation; status: "due" | "paid" | "partial" | "missing" }>,
): MonthCloseEvaluation {
  const unresolvedTransactions = getUnresolvedTransactions(periodTransactions);
  const duplicateGroups = getDuplicateGroups(periodTransactions);
  const missingCategoryTransactions = getMissingCategoryTransactions(periodTransactions, categories);
  const recurringDueCount = obligations.filter((entry) => entry.status !== "paid").length;
  const recurringMissingCount = obligations.filter((entry) => entry.status === "missing").length;

  return {
    unresolvedTransactions,
    duplicateGroups,
    missingCategoryTransactions,
    recurringDueCount,
    recurringMissingCount,
    isReadyToClose:
      unresolvedTransactions.length === 0 &&
      duplicateGroups.length === 0 &&
      missingCategoryTransactions.length === 0 &&
      recurringMissingCount === 0,
  };
}

export function buildMonthCloseRecord(
  existing: MonthClose | null,
  userId: string,
  period: string,
  evaluation: MonthCloseEvaluation,
): MonthClose {
  const timestamp = new Date().toISOString();

  return {
    id: existing?.id ?? `month-close:${period}`,
    userId,
    period,
    state: evaluation.isReadyToClose ? "ready" : "open",
    unresolvedTransactions: evaluation.unresolvedTransactions.length,
    duplicateAlerts: evaluation.duplicateGroups.length,
    missingCategoryCount: evaluation.missingCategoryTransactions.length,
    closedAt: existing?.closedAt,
    exportedAt: existing?.exportedAt,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}
