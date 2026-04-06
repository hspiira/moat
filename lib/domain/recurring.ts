import { getDebtRepaymentActions, type DebtPayoffStrategy } from "@/lib/domain/debt";
import type { Account, RecurringObligation, Transaction } from "@/lib/types";

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
  if (obligation.type === "sacco_contribution") {
    const isSaccoCredit =
      transaction.type === "transfer" &&
      transaction.amount > 0 &&
      (!obligation.linkedAccountId || transaction.accountId === obligation.linkedAccountId);

    if (isSaccoCredit) {
      return (
        matchesPayee(obligation, transaction) &&
        matchesAmount(obligation.expectedAmount, Math.abs(transaction.amount))
      );
    }
    if (transaction.type === "transfer") {
      return false;
    }
  } else if (transaction.type === "transfer") {
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

function getLatestMatchingTransaction(
  account: Account,
  transactions: Transaction[],
  types: Transaction["type"][],
) {
  return [...transactions]
    .filter(
      (transaction) =>
        transaction.accountId === account.id &&
        types.includes(transaction.type) &&
        Math.abs(transaction.amount) > 0,
    )
    .sort((left, right) => {
      if (left.occurredOn === right.occurredOn) {
        return right.createdAt.localeCompare(left.createdAt);
      }
      return right.occurredOn.localeCompare(left.occurredOn);
    })[0];
}

export function isSuggestedRecurringObligation(obligationId: string) {
  return obligationId.startsWith("suggested:");
}

export function buildSuggestedRecurringObligations(
  accounts: Account[],
  transactions: Transaction[],
  strategy: DebtPayoffStrategy,
  extraMonthlyPayment: number,
): RecurringObligation[] {
  const debtObligations = getDebtRepaymentActions(
    accounts,
    transactions,
    strategy,
    extraMonthlyPayment,
  ).map<RecurringObligation>((action) => ({
    id: `suggested:debt:${action.accountId}`,
    userId: "system",
    name: `${action.accountName} repayment`,
    type: "loan_repayment",
    categoryId: "",
    expectedAmount: Math.round(action.recommendedPayment),
    cadence: "monthly",
    dueDay: 28,
    linkedAccountId: action.accountId,
    payee: action.accountName,
    status: "active",
    createdAt: "",
    updatedAt: "",
  }));

  const saccoObligations = accounts
    .filter((account) => account.type === "sacco" && !account.isArchived)
    .map<RecurringObligation | null>((account) => {
      const latestContribution = getLatestMatchingTransaction(account, transactions, [
        "savings_contribution",
        "transfer",
      ]);

      if (!latestContribution || latestContribution.amount <= 0) {
        return null;
      }

      return {
        id: `suggested:sacco:${account.id}`,
        userId: "system",
        name: `${account.name} contribution`,
        type: "sacco_contribution",
        categoryId: latestContribution.categoryId,
        expectedAmount: Math.abs(latestContribution.amount),
        cadence: "monthly",
        dueDay: 28,
        linkedAccountId: account.id,
        payee: latestContribution.payee ?? latestContribution.rawPayee ?? account.name,
        status: "active",
        createdAt: "",
        updatedAt: "",
      };
    })
    .filter((obligation): obligation is RecurringObligation => obligation !== null);

  return [...debtObligations, ...saccoObligations];
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
