import { describe, expect, it } from "vitest";

import { buildShoppingHistory, pricePerUnit } from "@/lib/domain/shopping-history";
import type { Item, PlannedPurchase, Transaction, TransactionLineItem } from "@/lib/types";

const NOW = "2026-08-20T00:00:00.000Z";

function item(id: string, name: string, unit?: string): Item {
  return {
    id,
    userId: "u1",
    name,
    normalizedName: name.toLowerCase(),
    unit,
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function purchase(over: Partial<PlannedPurchase> & { id: string; itemId: string }): PlannedPurchase {
  return {
    userId: "u1",
    status: "purchased",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as PlannedPurchase;
}

function transaction(id: string, occurredOn: string): Transaction {
  return { id, userId: "u1", accountId: "acc1", occurredOn, amount: -1, type: "expense" } as Transaction;
}

function line(id: string, over: Partial<TransactionLineItem>): TransactionLineItem {
  return { id, userId: "u1", transactionId: "t1", label: "x", ...over } as TransactionLineItem;
}

describe("pricePerUnit", () => {
  it("divides the total by how many were bought", () => {
    expect(pricePerUnit(12_000, 3)).toBe(4_000);
  });

  it("rounds to whole shillings, which is what the ledger keeps", () => {
    expect(pricePerUnit(10_000, 3)).toBe(3_333);
  });

  it("says nothing when a quantity would make it a lie", () => {
    expect(pricePerUnit(12_000, undefined)).toBeUndefined();
    expect(pricePerUnit(12_000, 0)).toBeUndefined();
    expect(pricePerUnit(undefined, 3)).toBeUndefined();
  });
});

describe("buildShoppingHistory", () => {
  const sugar = item("i1", "Sugar", "kg");
  const rice = item("i2", "Rice", "kg");

  const bought = [
    purchase({ id: "p1", itemId: "i1", linkedTransactionId: "t1", linkedLineItemId: "l1", estimatedUnitPrice: 5_000, quantity: 1 }),
    purchase({ id: "p2", itemId: "i2", linkedTransactionId: "t1", linkedLineItemId: "l2", quantity: 2 }),
    purchase({ id: "p3", itemId: "i1", linkedTransactionId: "t2", linkedLineItemId: "l3", quantity: 1, updatedAt: "2026-08-22T00:00:00.000Z" }),
  ];

  const context = {
    itemsById: new Map([sugar, rice].map((i) => [i.id, i])),
    transactionsById: new Map([
      ["t1", transaction("t1", "2026-08-19")],
      ["t2", transaction("t2", "2026-08-22")],
    ]),
    lineItemsById: new Map([
      ["l1", line("l1", { quantity: 1, unitPrice: 4_000 })],
      ["l2", line("l2", { quantity: 2, unitPrice: 3_000 })],
      ["l3", line("l3", { quantity: 1, unitPrice: 4_500 })],
    ]),
  };

  it("groups what was bought by the trip that bought it", () => {
    const history = buildShoppingHistory({ purchases: bought, ...context });

    expect(history.trips).toHaveLength(2);
    expect(history.trips[0].transactionId).toBe("t2");
    expect(history.trips[1].entries.map((e) => e.item?.name)).toEqual(["Sugar", "Rice"]);
  });

  it("totals only the planned items on a trip, not the whole receipt", () => {
    const history = buildShoppingHistory({ purchases: bought, ...context });
    const firstTrip = history.trips.find((t) => t.transactionId === "t1");

    // 1 x 4,000 plus 2 x 3,000.
    expect(firstTrip?.total).toBe(10_000);
  });

  it("works out what one unit cost, so trips of different sizes compare", () => {
    const history = buildShoppingHistory({ purchases: bought, ...context });
    const riceEntry = history.trips
      .flatMap((t) => t.entries)
      .find((e) => e.item?.name === "Rice");

    expect(riceEntry?.pricePerUnit).toBe(3_000);
  });

  it("keeps what was dropped out of the trips entirely", () => {
    const history = buildShoppingHistory({
      purchases: [...bought, purchase({ id: "p4", itemId: "i2", status: "dropped" })],
      ...context,
    });

    expect(history.dropped.map((d) => d.purchase.id)).toEqual(["p4"]);
    expect(history.trips.flatMap((t) => t.entries).map((e) => e.purchase.id)).not.toContain("p4");
  });

  it("leaves anything still planned out of history", () => {
    const history = buildShoppingHistory({
      purchases: [purchase({ id: "p5", itemId: "i1", status: "planned" })],
      ...context,
    });

    expect(history.trips).toHaveLength(0);
    expect(history.dropped).toHaveLength(0);
  });
});
