import { categoryKindOrder } from "@/lib/domain/transaction-classification";
import type { Category, CategoryKind, Transaction } from "@/lib/types";

export type CategoryUse = {
  category: Category;
  count: number;
  /** Absolute total, so spending and income both read as a magnitude. */
  total: number;
  lastUsedOn: string | null;
};

export type CategoryGroup = {
  kind: CategoryKind;
  uses: CategoryUse[];
};

// "used 8" says nothing about whether a category matters. A total does.
export function buildCategoryOverview(
  categories: Category[],
  transactions: Transaction[],
): CategoryGroup[] {
  const totals = new Map<string, { count: number; total: number; lastUsedOn: string | null }>();

  for (const transaction of transactions) {
    const entry = totals.get(transaction.categoryId) ?? { count: 0, total: 0, lastUsedOn: null };
    entry.count += 1;
    entry.total += Math.abs(transaction.amount);
    if (!entry.lastUsedOn || transaction.occurredOn > entry.lastUsedOn) {
      entry.lastUsedOn = transaction.occurredOn;
    }
    totals.set(transaction.categoryId, entry);
  }

  return categoryKindOrder
    .map((kind) => ({
      kind,
      uses: categories
        .filter((category) => category.kind === kind)
        .map((category) => {
          const entry = totals.get(category.id);
          return {
            category,
            count: entry?.count ?? 0,
            total: entry?.total ?? 0,
            lastUsedOn: entry?.lastUsedOn ?? null,
          };
        })
        // Biggest first, so the ones that matter lead. Unused fall to the
        // bottom in name order rather than being scattered by a zero total.
        .sort((left, right) =>
          right.total - left.total || left.category.name.localeCompare(right.category.name),
        ),
    }))
    .filter((group) => group.uses.length > 0);
}

/** A category still referenced by a transaction can be hidden but never removed. */
export function isCategoryInUse(use: CategoryUse): boolean {
  return use.count > 0;
}
