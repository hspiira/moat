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
  it("sums (quantity ?? 1) × estimatedUnitPrice and counts unestimated rows", () => {
    const result = estimatePlannedTotal([
      purchase({ estimatedUnitPrice: 3500, quantity: 2 }),
      purchase({ estimatedUnitPrice: 4000 }),
      purchase({}),
      purchase({ status: "purchased", estimatedUnitPrice: 99999 }),
    ]);
    expect(result).toEqual({ total: 11000, unestimatedCount: 1 });
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
