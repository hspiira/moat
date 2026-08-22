import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { Item, PlannedPurchase } from "@/lib/types";

export type PlannedAgainstBudget = {
  categoryId: string;
  categoryName: string;
  planned: number;
  remaining: number;
  // Positive means the plan does not fit what is left.
  shortfall: number;
};

// What a trip costs is only half the question. The other half is whether what
// is left in the envelope covers it, and that can only be answered per category.
export function comparePlannedWithBudget(params: {
  purchases: PlannedPurchase[];
  items: Item[];
  envelopes: BudgetEnvelope[];
  lastPaidFor?: (itemId: string) => number | undefined;
}): PlannedAgainstBudget[] {
  const categoryOf = new Map(
    params.items.map((item) => [item.id, item.defaultCategoryId]),
  );
  const plannedByCategory = new Map<string, number>();

  for (const purchase of params.purchases) {
    if (purchase.status !== "planned") continue;

    const categoryId = categoryOf.get(purchase.itemId);
    if (!categoryId) continue;

    const unit =
      purchase.estimatedUnitPrice ?? params.lastPaidFor?.(purchase.itemId) ?? undefined;
    if (unit == null || unit <= 0) continue;

    plannedByCategory.set(
      categoryId,
      (plannedByCategory.get(categoryId) ?? 0) + (purchase.quantity ?? 1) * unit,
    );
  }

  return params.envelopes
    .filter((envelope) => plannedByCategory.has(envelope.categoryId))
    .map((envelope) => {
      const planned = plannedByCategory.get(envelope.categoryId) ?? 0;
      return {
        categoryId: envelope.categoryId,
        categoryName: envelope.categoryName,
        planned,
        remaining: envelope.remaining,
        shortfall: Math.max(0, planned - envelope.remaining),
      };
    })
    .sort((left, right) => right.shortfall - left.shortfall || right.planned - left.planned);
}
