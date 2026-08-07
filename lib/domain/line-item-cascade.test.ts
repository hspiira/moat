import { describe, expect, it } from "vitest";

import { planLineItemCascade } from "@/lib/domain/line-item-cascade";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

const lineOnT1: TransactionLineItem = {
  id: "line:1",
  userId: "user-1",
  transactionId: "transaction:t1",
  label: "Sugar",
  plannedPurchaseId: "planned:1",
  createdAt: now,
  updatedAt: now,
};

const lineOnT2: TransactionLineItem = { ...lineOnT1, id: "line:2", transactionId: "transaction:t2", plannedPurchaseId: undefined };

const purchase: PlannedPurchase = {
  id: "planned:1",
  userId: "user-1",
  itemId: "item:sugar",
  status: "purchased",
  linkedTransactionId: "transaction:t1",
  linkedLineItemId: "line:1",
  createdAt: now,
  updatedAt: now,
};

describe("planLineItemCascade", () => {
  it("deletes lines of deleted transactions and reverts their purchases", () => {
    const plan = planLineItemCascade({
      deletedTransactionIds: new Set(["transaction:t1"]),
      lineItems: [lineOnT1, lineOnT2],
      plannedPurchases: [purchase],
      timestamp: "2026-08-08T00:00:00.000Z",
    });
    expect(plan.lineItemIdsToDelete).toEqual(["line:1"]);
    expect(plan.purchasesToRevert).toHaveLength(1);
    expect(plan.purchasesToRevert[0]).toMatchObject({
      id: "planned:1",
      status: "planned",
      linkedTransactionId: undefined,
      linkedLineItemId: undefined,
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
  });

  it("is a no-op when nothing matches", () => {
    const plan = planLineItemCascade({
      deletedTransactionIds: new Set(["transaction:none"]),
      lineItems: [lineOnT1],
      plannedPurchases: [purchase],
      timestamp: now,
    });
    expect(plan.lineItemIdsToDelete).toEqual([]);
    expect(plan.purchasesToRevert).toEqual([]);
  });
});
