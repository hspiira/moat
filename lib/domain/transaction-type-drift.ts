import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { transactionTypeForCategory } from "@/lib/domain/transaction-classification";
import type { Category, Transaction } from "@/lib/types";

export type TypeDrift = {
  repaired: Transaction[];
  needsReview: Transaction[];
};

export function findTransactionTypeDrift(
  transactions: Transaction[],
  categories: Category[],
  timestamp: string,
): TypeDrift {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const repaired: Transaction[] = [];
  const needsReview: Transaction[] = [];

  for (const transaction of transactions) {
    const category = byId.get(transaction.categoryId);
    if (!category) continue;

    const expected = transactionTypeForCategory(category);
    if (!expected || expected === transaction.type) continue;

    const next = { ...transaction, type: expected, updatedAt: timestamp };

    if (expected === "transfer" || transaction.type === "transfer") {
      needsReview.push(transaction);
      continue;
    }

    if (getTransactionBalanceDelta(next) !== getTransactionBalanceDelta(transaction)) {
      needsReview.push(transaction);
      continue;
    }

    repaired.push(next);
  }

  return { repaired, needsReview };
}
