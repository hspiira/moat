import type { Category, Transaction } from "@/lib/types";

export function countCategoryUsage(transactions: Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
  }

  return counts;
}

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
      return left.name.localeCompare(right.name);
    });
}
