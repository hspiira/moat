import type { Item, PlannedPurchase, TransactionLineItem } from "@/lib/types";
import { createId } from "@/lib/ids";

export type PlannedEstimate = {
  total: number;
  typed: number;
  remembered: number;
  unknownCount: number;
};

// A price you typed wins over one from memory, because you may know something
// this trip that last month's receipt does not. Where you typed nothing, what
// you last paid is a far better guess than nothing at all.
export function estimatePlannedTotal(
  purchases: PlannedPurchase[],
  lastPaidFor?: (itemId: string) => number | undefined,
): PlannedEstimate {
  let typed = 0;
  let remembered = 0;
  let unknownCount = 0;

  for (const purchase of purchases) {
    if (purchase.status !== "planned") continue;
    const quantity = purchase.quantity ?? 1;

    if (purchase.estimatedUnitPrice != null) {
      typed += quantity * purchase.estimatedUnitPrice;
      continue;
    }

    const remembered_ = lastPaidFor?.(purchase.itemId);
    if (remembered_ != null && remembered_ > 0) {
      remembered += quantity * remembered_;
      continue;
    }

    unknownCount += 1;
  }

  return { total: typed + remembered, typed, remembered, unknownCount };
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
  actual: { quantity?: number; unitPrice?: number },
): TransactionLineItem {
  return {
    id: createId(),
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
