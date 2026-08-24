import { describe, expect, it } from "vitest";

import { isInstallmentPurchase, summariseInstallments } from "@/lib/domain/installments";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

function purchase(over: Partial<PlannedPurchase> = {}): PlannedPurchase {
  return {
    id: "p1",
    userId: "u1",
    itemId: "i1",
    status: "planned",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    ...over,
  } as PlannedPurchase;
}

function line(id: string, over: Partial<TransactionLineItem> = {}): TransactionLineItem {
  return {
    id,
    userId: "u1",
    transactionId: `t-${id}`,
    label: "payment",
    plannedPurchaseId: "p1",
    ...over,
  } as TransactionLineItem;
}

describe("summariseInstallments", () => {
  const sofa = purchase({ expectedTotal: 500_000 });

  it("adds up what has been paid and what is still owed", () => {
    const plan = summariseInstallments(sofa, [
      line("l1", { amount: 200_000 }),
      line("l2", { amount: 150_000 }),
    ]);

    expect(plan).toMatchObject({
      expected: 500_000,
      paid: 350_000,
      remaining: 150_000,
      isSettled: false,
      percentPaid: 70,
    });
  });

  it("counts a payment recorded as a quantity and a price", () => {
    const plan = summariseInstallments(sofa, [line("l1", { quantity: 2, unitPrice: 50_000 })]);

    expect(plan.paid).toBe(100_000);
  });

  it("ignores lines belonging to a different purchase", () => {
    const plan = summariseInstallments(sofa, [
      line("l1", { amount: 200_000 }),
      line("l2", { amount: 999_000, plannedPurchaseId: "other" }),
    ]);

    expect(plan.paid).toBe(200_000);
  });

  it("settles once the agreed price is met", () => {
    const plan = summariseInstallments(sofa, [line("l1", { amount: 500_000 })]);

    expect(plan).toMatchObject({ isSettled: true, remaining: 0, percentPaid: 100 });
  });

  it("never owes a negative amount, or fills past full, when overpaid", () => {
    const plan = summariseInstallments(sofa, [line("l1", { amount: 600_000 })]);

    expect(plan.remaining).toBe(0);
    expect(plan.percentPaid).toBe(100);
    expect(plan.isSettled).toBe(true);
  });

  it("falls back to the estimate when no full price was agreed", () => {
    const plan = summariseInstallments(
      purchase({ quantity: 3, estimatedUnitPrice: 10_000 }),
      [line("l1", { amount: 10_000 })],
    );

    expect(plan.expected).toBe(30_000);
    expect(plan.remaining).toBe(20_000);
  });

  it("owes nothing when there is nothing to go on", () => {
    const plan = summariseInstallments(purchase(), []);

    expect(plan).toMatchObject({ expected: 0, paid: 0, remaining: 0, isSettled: false });
  });
});

describe("isInstallmentPurchase", () => {
  it("is true only when a full price was agreed up front", () => {
    expect(isInstallmentPurchase(purchase({ expectedTotal: 500_000 }))).toBe(true);
    expect(isInstallmentPurchase(purchase())).toBe(false);
    expect(isInstallmentPurchase(purchase({ expectedTotal: 0 }))).toBe(false);
  });
});
