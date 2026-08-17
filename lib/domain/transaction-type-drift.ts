import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { transactionTypeForCategory } from "@/lib/domain/transaction-classification";
import type { Category, Transaction } from "@/lib/types";

export type TypeDrift = {
  /** Safe to rewrite: the balance delta is identical. */
  repaired: Transaction[];
  /** Rewriting would move money or need a second row. Left alone. */
  needsReview: Transaction[];
};

// Seeded category kinds have changed over time. reconcileDefaultCategories
// updates the category but nothing updated transactions already filed under it,
// so a row can carry a type its category no longer permits. assertCategoryMatchesType
// then rejects it on save, which makes the row impossible to edit.
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

    // A transfer is a balanced pair, so a lone row cannot become one.
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
