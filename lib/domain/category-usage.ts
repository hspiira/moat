import type { Category, Transaction } from "@/lib/types";

/**
 * Ordering the category picker by how often each category is used.
 *
 * The app seeds 21 categories. Most people use five of them. Listing them in
 * seed order made the common ones scroll away behind the rare ones.
 */

/** How many transactions use each category, keyed by categoryId. */
export function countCategoryUsage(transactions: Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
  }

  return counts;
}

/**
 * Most used first, then unused ones by name. A hidden category stays out of
 * the list, unless a transaction still uses it — otherwise opening that
 * transaction would show an empty picker.
 */
export function orderCategoriesForPicker(
  categories: Category[],
  usage: Map<string, number>,
): Category[] {
  return categories
    .filter((category) => !category.isArchived || (usage.get(category.id) ?? 0) > 0)
    .slice()
    .sort((left, right) => {
      const leftUse = usage.get(left.id) ?? 0;
      const rightUse = usage.get(right.id) ?? 0;
      if (leftUse !== rightUse) {
        return rightUse - leftUse;
      }
      // A stable second key keeps the list from reordering as counts change.
      return left.name.localeCompare(right.name);
    });
}
