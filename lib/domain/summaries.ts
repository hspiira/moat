import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { excludeTransfers, isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Category, MonthSummary, Transaction } from "@/lib/types";

function buildSummary(
  transactions: Transaction[],
  categories: Category[],
  openingBalance = 0,
): MonthSummary {
  const spendingTransactions = excludeTransfers(transactions);

  const inflow = spendingTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const outflow = spendingTransactions
    .filter(isSpendingTransaction)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const allocatedSavings = spendingTransactions
    .filter((transaction) => transaction.type === "savings_contribution")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const transfers = transactions
    .filter(isTransferTransaction)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const savings = inflow - outflow;
  const net = inflow - outflow - allocatedSavings;
  const movement = transactions.reduce(
    (sum, transaction) => sum + getTransactionBalanceDelta(transaction),
    0,
  );
  const closingBalance = openingBalance + movement;

  const categoryTotals = new Map<string, { amount: number; count: number }>();

  for (const transaction of spendingTransactions) {
    if (!isSpendingTransaction(transaction)) {
      continue;
    }

    const entry = categoryTotals.get(transaction.categoryId) ?? { amount: 0, count: 0 };
    entry.amount += Math.abs(transaction.amount);
    entry.count += 1;
    categoryTotals.set(transaction.categoryId, entry);
  }

  const categoryLookup = new Map(categories.map((category) => [category.id, category.name]));

  const topCategories = [...categoryTotals.entries()]
    .map(([categoryId, entry]) => ({
      categoryId,
      categoryName: categoryLookup.get(categoryId) ?? "Uncategorized",
      amount: entry.amount,
      count: entry.count,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  return {
    openingBalance,
    inflow,
    outflow,
    savings,
    allocatedSavings,
    transfers,
    movement,
    closingBalance,
    net,
    topCategories,
  };
}

function isMonthMatch(date: string, month: string): boolean {
  return date.startsWith(month);
}

export function getMonthSummary(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): MonthSummary {
  const monthlyTransactions = transactions.filter((transaction) =>
    isMonthMatch(transaction.occurredOn, month),
  );

  return buildSummary(monthlyTransactions, categories);
}

export function getSummaryForTransactions(
  transactions: Transaction[],
  categories: Category[],
  openingBalance = 0,
): MonthSummary {
  return buildSummary(transactions, categories, openingBalance);
}

export function getAggregateOpeningBalance(accounts: Account[]) {
  return accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + account.openingBalance, 0);
}

export function getSavingsRate(summary: MonthSummary): number {
  if (summary.inflow <= 0) {
    return 0;
  }

  return summary.savings / summary.inflow;
}
