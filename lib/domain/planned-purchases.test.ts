import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildFulfillmentLineItem,
  estimatePlannedTotal,
  fulfillPurchase,
  groupPlannerRows,
  revertPurchase,
  sumFulfillmentCost,
} from "@/lib/domain/planned-purchases";
import type { Item, PlannedPurchase } from "@/lib/types";
import { isValidId } from "@/lib/ids";

const now = "2026-08-07T00:00:00.000Z";

function purchase(overrides: Partial<PlannedPurchase> = {}): PlannedPurchase {
  return {
    id: `planned:${crypto.randomUUID()}`,
    userId: "user-1",
    itemId: "item:sugar",
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const sugar: Item = {
  id: "item:sugar",
  userId: "user-1",
  name: "Sugar (1kg)",
  normalizedName: "sugar (1kg)",
  isArchived: false,
  createdAt: now,
  updatedAt: now,
};

describe("estimatePlannedTotal", () => {
  it("sums (quantity ?? 1) × estimatedUnitPrice and counts what has no price", () => {
    const result = estimatePlannedTotal([
      purchase({ estimatedUnitPrice: 3500, quantity: 2 }),
      purchase({ estimatedUnitPrice: 4000 }),
      purchase({}),
      purchase({ status: "purchased", estimatedUnitPrice: 99999 }),
    ]);
    expect(result).toEqual({ total: 11000, typed: 11000, remembered: 0, unknownCount: 1 });
  });
});

describe("groupPlannerRows", () => {
  it("splits by neededBy relative to today, history last", () => {
    const overdue = purchase({ neededBy: "2026-08-01" });
    const upcoming = purchase({ neededBy: "2026-08-20" });
    const someday = purchase({});
    const done = purchase({ status: "purchased" });
    const dropped = purchase({ status: "dropped" });

    const groups = groupPlannerRows([overdue, upcoming, someday, done, dropped], "2026-08-07");
    expect(groups.overdue).toEqual([overdue]);
    expect(groups.upcoming).toEqual([upcoming]);
    expect(groups.someday).toEqual([someday]);
    expect(groups.history).toEqual([done, dropped]);
  });

  it("counts today as upcoming, not overdue", () => {
    const dueToday = purchase({ neededBy: "2026-08-07" });
    const groups = groupPlannerRows([dueToday], "2026-08-07");
    expect(groups.upcoming).toEqual([dueToday]);
  });
});

describe("fulfillment", () => {
  it("records what was paid, not what was estimated", () => {
    const planned = purchase({ quantity: 2, estimatedUnitPrice: 3500 });
    const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now, {
      unitPrice: 4200,
    });

    expect(lineItem).toMatchObject({
      transactionId: "transaction:t1",
      itemId: "item:sugar",
      label: "Sugar (1kg)",
      quantity: 2,
      unitPrice: 4200,
      plannedPurchaseId: planned.id,
    });
    expect(isValidId(lineItem.id)).toBe(true);
  });

  it("leaves the price unknown rather than falling back to the estimate", () => {
    const planned = purchase({ quantity: 2, estimatedUnitPrice: 3500 });
    const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now, {});

    expect(lineItem.unitPrice).toBeUndefined();
  });

  it("takes the quantity actually bought when it differs from the plan", () => {
    const planned = purchase({ quantity: 2, estimatedUnitPrice: 3500 });
    const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now, {
      quantity: 5,
      unitPrice: 4200,
    });

    expect(lineItem.quantity).toBe(5);
  });

  it("keeps the planned quantity when none is given", () => {
    const planned = purchase({ quantity: 2, estimatedUnitPrice: 3500 });
    const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now, {
      unitPrice: 4200,
    });

    expect(lineItem.quantity).toBe(2);
  });

  it("fulfill then revert round-trips the purchase state", () => {
    fc.assert(
      fc.property(
        fc.option(fc.nat({ max: 100 }), { nil: undefined }),
        fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }),
        (quantity, estimatedUnitPrice) => {
          const planned = purchase({ quantity, estimatedUnitPrice });
          const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now, {});
          const fulfilled = fulfillPurchase(planned, lineItem, now);
          expect(fulfilled.status).toBe("purchased");
          expect(fulfilled.linkedTransactionId).toBe("transaction:t1");
          expect(fulfilled.linkedLineItemId).toBe(lineItem.id);

          const reverted = revertPurchase(fulfilled, "2026-08-08T00:00:00.000Z");
          expect(reverted).toEqual({
            ...planned,
            updatedAt: "2026-08-08T00:00:00.000Z",
          });
        },
      ),
    );
  });
});

describe("sumFulfillmentCost", () => {
  it("totals quantity × unit price across entries", () => {
    expect(
      sumFulfillmentCost([
        { quantity: 2, unitPrice: 4500 },
        { quantity: 1, unitPrice: 2500 },
      ]),
    ).toBe(11500);
  });

  it("treats a missing quantity as one", () => {
    expect(sumFulfillmentCost([{ unitPrice: 4500 }])).toBe(4500);
  });

  it("skips entries with no price rather than counting them as free", () => {
    expect(sumFulfillmentCost([{ quantity: 2, unitPrice: 4500 }, { quantity: 3 }])).toBe(9000);
  });

  it("is zero for nothing selected", () => {
    expect(sumFulfillmentCost([])).toBe(0);
  });
});

describe("estimatePlannedTotal with what you last paid", () => {
  const lastPaid = (itemId: string) => (itemId === "item:rice" ? 8_000 : undefined);

  it("uses what you last paid where you typed no price", () => {
    const result = estimatePlannedTotal(
      [purchase({ itemId: "item:rice", quantity: 2 })],
      lastPaid,
    );

    expect(result).toMatchObject({ total: 16_000, typed: 0, remembered: 16_000, unknownCount: 0 });
  });

  it("prefers the price you typed over the one it remembers", () => {
    const result = estimatePlannedTotal(
      [purchase({ itemId: "item:rice", quantity: 1, estimatedUnitPrice: 9_500 })],
      lastPaid,
    );

    expect(result).toMatchObject({ total: 9_500, typed: 9_500, remembered: 0 });
  });

  it("still counts what it cannot guess at", () => {
    const result = estimatePlannedTotal(
      [purchase({ itemId: "item:salt" }), purchase({ itemId: "item:rice" })],
      lastPaid,
    );

    expect(result).toMatchObject({ total: 8_000, remembered: 8_000, unknownCount: 1 });
  });

  it("keeps the two apart, so the page can say which is a guess", () => {
    const result = estimatePlannedTotal(
      [
        purchase({ itemId: "item:rice" }),
        purchase({ itemId: "item:oil", estimatedUnitPrice: 12_000 }),
      ],
      lastPaid,
    );

    expect(result).toMatchObject({ total: 20_000, typed: 12_000, remembered: 8_000 });
  });

  it("does not treat a remembered price of nothing as a price", () => {
    const result = estimatePlannedTotal([purchase({ itemId: "item:free" })], () => 0);

    expect(result).toMatchObject({ total: 0, unknownCount: 1 });
  });

  it("counts nothing for what has already been bought", () => {
    const result = estimatePlannedTotal(
      [purchase({ itemId: "item:rice", status: "purchased" })],
      lastPaid,
    );

    expect(result).toMatchObject({ total: 0, unknownCount: 0 });
  });

  it("works with no memory to draw on, as it did before", () => {
    const result = estimatePlannedTotal([purchase({ itemId: "item:rice" })]);

    expect(result).toMatchObject({ total: 0, unknownCount: 1 });
  });
});
