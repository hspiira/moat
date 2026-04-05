import { excludeTransfers } from "@/lib/domain/transfers";
import type { Category, MonthSummary, Transaction } from "@/lib/types";

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
  const spendingTransactions = excludeTransfers(monthlyTransactions);

  const inflow = spendingTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const outflow = spendingTransactions
    .filter((transaction) => transaction.type === "expense" || transaction.type === "debt_payment")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const savings = spendingTransactions
    .filter((transaction) => transaction.type === "savings_contribution")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const transfers = monthlyTransactions
    .filter((transaction) => transaction.type === "transfer")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const categoryTotals = new Map<string, number>();

  for (const transaction of spendingTransactions) {
    if (transaction.type !== "expense" && transaction.type !== "debt_payment") {
      continue;
    }

    categoryTotals.set(
      transaction.categoryId,
      (categoryTotals.get(transaction.categoryId) ?? 0) + transaction.amount,
    );
  }

  const categoryLookup = new Map(categories.map((category) => [category.id, category.name]));

  const topCategories = [...categoryTotals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryLookup.get(categoryId) ?? "Uncategorized",
      amount,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  return {
    inflow,
    outflow,
    savings,
    transfers,
    net: inflow - outflow - savings,
    topCategories,
  };
}

export function getSavingsRate(summary: MonthSummary): number {
  if (summary.inflow <= 0) {
    return 0;
  }

  return summary.savings / summary.inflow;
}
