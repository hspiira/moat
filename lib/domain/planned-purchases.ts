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

export function buildFulfillmentLineItem(
  purchase: PlannedPurchase,
  item: Item,
  transactionId: string,
  timestamp: string,
): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: purchase.userId,
    transactionId,
    itemId: purchase.itemId,
    label: item.name,
    quantity: purchase.quantity,
    unitPrice: purchase.estimatedUnitPrice,
    plannedPurchaseId: purchase.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
