import type { Item, PlannedPurchase } from "@/lib/types";

export type GroupedPurchases = {
  /** Empty for the items that belong under nothing. */
  group: string;
  purchases: PlannedPurchase[];
};

const UNGROUPED = "";

/**
 * Planned purchases gathered under what they belong to, so a long list reads as
 * groceries, then furniture, then the rest, rather than forty unrelated rows.
 *
 * Ungrouped items come last and unlabelled: they are not a category called
 * "other", they are simply the ones nobody has filed yet.
 */
export function groupPurchasesByItemGroup(
  purchases: PlannedPurchase[],
  itemsById: Map<string, Item>,
): GroupedPurchases[] {
  const byGroup = new Map<string, GroupedPurchases>();

  for (const purchase of purchases) {
    const group = itemsById.get(purchase.itemId)?.group?.trim() || UNGROUPED;
    const existing = byGroup.get(group);
    if (existing) existing.purchases.push(purchase);
    else byGroup.set(group, { group, purchases: [purchase] });
  }

  return [...byGroup.values()].sort((left, right) => {
    if (left.group === UNGROUPED) return 1;
    if (right.group === UNGROUPED) return -1;
    return left.group.localeCompare(right.group);
  });
}

/** Whether gathering is worth doing at all, so one group is not a heading over everything. */
export function isWorthGrouping(grouped: GroupedPurchases[]): boolean {
  return grouped.filter((entry) => entry.group !== UNGROUPED).length > 0 && grouped.length > 1;
}
