import type { Item, PlannedPurchase, Transaction, TransactionLineItem } from "@/lib/types";

import { comparePlannedWithActual, type PlannedOutcome } from "@/lib/domain/planned-purchases";

export type BoughtEntry = {
  purchase: PlannedPurchase;
  item?: Item;
  outcome: PlannedOutcome;
  quantity?: number;
  /** What one unit cost, when a quantity is known. Compares across trips. */
  pricePerUnit?: number;
};

export type ShoppingTrip = {
  transactionId: string;
  occurredOn: string;
  accountId?: string;
  entries: BoughtEntry[];
  /** What the planned items on this trip cost, not the whole receipt. */
  total: number;
};

export type ShoppingHistory = {
  trips: ShoppingTrip[];
  dropped: { purchase: PlannedPurchase; item?: Item }[];
};

/**
 * What one unit cost, for comparing a price across trips of different sizes.
 * Needs a quantity, since a total alone says nothing about value.
 */
export function pricePerUnit(total?: number, quantity?: number): number | undefined {
  if (total == null || quantity == null || quantity <= 0) return undefined;
  return Math.round(total / quantity);
}

/**
 * Splits finished purchases into the trips that bought them and the ones that
 * were dropped. Trips carry their own total so a shop can be read at a glance,
 * newest first.
 */
export function buildShoppingHistory(params: {
  purchases: PlannedPurchase[];
  itemsById: Map<string, Item>;
  transactionsById: Map<string, Transaction>;
  lineItemsById: Map<string, TransactionLineItem>;
}): ShoppingHistory {
  const trips = new Map<string, ShoppingTrip>();
  const dropped: ShoppingHistory["dropped"] = [];

  for (const purchase of params.purchases) {
    const item = params.itemsById.get(purchase.itemId);

    if (purchase.status === "dropped") {
      dropped.push({ purchase, item });
      continue;
    }
    if (purchase.status !== "purchased" || !purchase.linkedTransactionId) continue;

    const lineItem = purchase.linkedLineItemId
      ? params.lineItemsById.get(purchase.linkedLineItemId)
      : undefined;
    const outcome = comparePlannedWithActual(purchase, lineItem);
    const quantity = lineItem?.quantity ?? purchase.quantity;

    const expense = params.transactionsById.get(purchase.linkedTransactionId);
    const trip = trips.get(purchase.linkedTransactionId) ?? {
      transactionId: purchase.linkedTransactionId,
      occurredOn: expense?.occurredOn ?? purchase.updatedAt,
      accountId: expense?.accountId,
      entries: [],
      total: 0,
    };

    trip.entries.push({
      purchase,
      item,
      outcome,
      quantity,
      pricePerUnit: pricePerUnit(outcome.actual, quantity),
    });
    trip.total += outcome.actual ?? 0;
    trips.set(trip.transactionId, trip);
  }

  return {
    trips: [...trips.values()].sort((left, right) =>
      right.occurredOn.localeCompare(left.occurredOn),
    ),
    dropped: dropped.sort((left, right) =>
      right.purchase.updatedAt.localeCompare(left.purchase.updatedAt),
    ),
  };
}
