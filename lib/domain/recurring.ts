import type { RecurringObligation, Transaction } from "@/lib/types";

export type RecurringMatchState = "paid" | "partial" | "missing";

export type RecurringEvaluation = {
  obligation: RecurringObligation;
  matchedTransactions: Transaction[];
  matchedAmount: number;
  expectedAmount: number;
  state: RecurringMatchState;
};

function getMonthPrefix(date: string) {
  return date.slice(0, 7);
}

function normalizeText(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function isTransactionInPeriod(transaction: Transaction, period: string) {
  if (period.length === 7) {
    return getMonthPrefix(transaction.occurredOn) === period;
  }

  return transaction.occurredOn.startsWith(period);
}

function matchesPayee(obligation: RecurringObligation, transaction: Transaction) {
  if (!obligation.payee) {
    return true;
  }

  const payee = normalizeText(obligation.payee);
  const transactionPayee = normalizeText(transaction.payee ?? transaction.rawPayee ?? transaction.note);

  return Boolean(transactionPayee) && transactionPayee.includes(payee);
}

function matchesAmount(expectedAmount: number, actualAmount: number) {
  const tolerance = Math.max(expectedAmount * 0.05, 1_000);
  return Math.abs(expectedAmount - actualAmount) <= tolerance;
}

function matchesObligation(
  obligation: RecurringObligation,
  transaction: Transaction,
) {
  if (transaction.type === "transfer") {
    return false;
  }

  if (obligation.linkedAccountId && transaction.accountId !== obligation.linkedAccountId) {
    return false;
  }

  if (obligation.categoryId && transaction.categoryId !== obligation.categoryId) {
    return false;
  }

  if (!matchesPayee(obligation, transaction)) {
    return false;
  }

  return matchesAmount(obligation.expectedAmount, Math.abs(transaction.amount));
}

export function evaluateRecurringObligations(
  obligations: RecurringObligation[],
  transactions: Transaction[],
  period: string,
): RecurringEvaluation[] {
  const activeObligations = obligations.filter((obligation) => obligation.status === "active");
  const periodTransactions = transactions.filter((transaction) =>
    isTransactionInPeriod(transaction, period),
  );

  return activeObligations.map((obligation) => {
    const matchedTransactions = periodTransactions.filter((transaction) =>
      matchesObligation(obligation, transaction),
    );
    const matchedAmount = matchedTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0,
    );

    let state: RecurringMatchState = "missing";
    if (matchedAmount >= obligation.expectedAmount) {
      state = "paid";
    } else if (matchedAmount > 0) {
      state = "partial";
    }

    return {
      obligation,
      matchedTransactions,
      matchedAmount,
      expectedAmount: obligation.expectedAmount,
      state,
    };
  });
}
