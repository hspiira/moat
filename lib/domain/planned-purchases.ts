import type { Item, PlannedPurchase, TransactionLineItem } from "@/lib/types";

export function estimatePlannedTotal(purchases: PlannedPurchase[]): {
  total: number;
  unestimatedCount: number;
} {
  let total = 0;
  let unestimatedCount = 0;
  for (const purchase of purchases) {
    if (purchase.status !== "planned") continue;
    if (purchase.estimatedUnitPrice == null) {
      unestimatedCount += 1;
      continue;
    }
    total += (purchase.quantity ?? 1) * purchase.estimatedUnitPrice;
  }
  return { total, unestimatedCount };
}

export type PlannerGroups = {
  overdue: PlannedPurchase[];
  upcoming: PlannedPurchase[];
  someday: PlannedPurchase[];
  history: PlannedPurchase[];
};

export function groupPlannerRows(purchases: PlannedPurchase[], today: string): PlannerGroups {
  const groups: PlannerGroups = { overdue: [], upcoming: [], someday: [], history: [] };
  for (const purchase of purchases) {
    if (purchase.status !== "planned") {
      groups.history.push(purchase);
    } else if (!purchase.neededBy) {
      groups.someday.push(purchase);
    } else if (purchase.neededBy < today) {
      groups.overdue.push(purchase);
    } else {
      groups.upcoming.push(purchase);
    }
  }
  return groups;
}

/**
 * Turns a plan into the line item on the expense that fulfilled it.
 *
 * `actual` is what was really paid, and it is never backfilled from the
 * estimate. The price memory ("what it cost last time") is derived from these
 * line items, so writing the estimate here made the planner quote your own
 * guess back at you as though it were history. An unknown price is recorded as
 * unknown; only the quantity may fall back to the plan, since an unstated
 * quantity is still what you intended to buy.
 */
export function buildFulfillmentLineItem(
  purchase: PlannedPurchase,
  item: Item,
  transactionId: string,
  timestamp: string,
  actual: { quantity?: number; unitPrice?: number },
): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: purchase.userId,
    transactionId,
    itemId: purchase.itemId,
    label: item.name,
    quantity: actual.quantity ?? purchase.quantity,
    unitPrice: actual.unitPrice,
    plannedPurchaseId: purchase.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** What a set of check-off entries actually cost, for the expense total. */
export function sumFulfillmentCost(
  entries: { quantity?: number; unitPrice?: number }[],
): number {
  return entries.reduce(
    (total, entry) => total + (entry.unitPrice != null ? (entry.quantity ?? 1) * entry.unitPrice : 0),
    0,
  );
}

export function fulfillPurchase(
  purchase: PlannedPurchase,
  lineItem: TransactionLineItem,
  timestamp: string,
): PlannedPurchase {
  return {
    ...purchase,
    status: "purchased",
    linkedTransactionId: lineItem.transactionId,
    linkedLineItemId: lineItem.id,
    updatedAt: timestamp,
  };
}

export function revertPurchase(purchase: PlannedPurchase, timestamp: string): PlannedPurchase {
  return {
    ...purchase,
    status: "planned",
    linkedTransactionId: undefined,
    linkedLineItemId: undefined,
    updatedAt: timestamp,
  };
}
