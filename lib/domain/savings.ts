import type { Category, Transaction } from "@/lib/types";

export function savingsCategoryIds(categories: Category[]): Set<string> {
  return new Set(
    categories.filter((category) => category.kind === "savings").map((category) => category.id),
  );
}

export function isLegacySavingsContribution(transaction: Transaction): boolean {
  return transaction.type === "savings_contribution";
}

export function isSavingsAllocation(
  transaction: Transaction,
  savingsIds: Set<string>,
): boolean {
  if (isLegacySavingsContribution(transaction)) return true;
  return (
    transaction.type === "transfer" &&
    savingsIds.has(transaction.categoryId) &&
    transaction.amount < 0
  );
}

export function isSavingsDeposit(
  transaction: Transaction,
  savingsIds: Set<string>,
): boolean {
  return (
    transaction.type === "transfer" &&
    savingsIds.has(transaction.categoryId) &&
    transaction.amount > 0
  );
}

export function sumSavingsAllocated(
  transactions: Transaction[],
  categories: Category[],
): number {
  const savingsIds = savingsCategoryIds(categories);
  return transactions.reduce(
    (sum, transaction) =>
      isSavingsAllocation(transaction, savingsIds) ? sum + Math.abs(transaction.amount) : sum,
    0,
  );
}
