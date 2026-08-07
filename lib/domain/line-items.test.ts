import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lineItemAmount, summarizeItemization } from "@/lib/domain/line-items";
import type { TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

function line(overrides: Partial<TransactionLineItem>): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: "user-1",
    transactionId: "transaction:t1",
    label: "Sugar",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("lineItemAmount", () => {
  it("prefers the explicit amount", () => {
    expect(lineItemAmount({ amount: 3500, quantity: 2, unitPrice: 2000 })).toBe(3500);
  });

  it("derives quantity times unit price when amount is absent", () => {
    expect(lineItemAmount({ quantity: 2, unitPrice: 1750 })).toBe(3500);
  });

  it("is undefined when neither is computable", () => {
    expect(lineItemAmount({ quantity: 2 })).toBeUndefined();
    expect(lineItemAmount({})).toBeUndefined();
  });
});

describe("summarizeItemization", () => {
  it("reports partial itemization with a remainder", () => {
    const summary = summarizeItemization(60000, [
      line({ amount: 41500 }),
      line({ label: "Salt" }),
    ]);
    expect(summary).toEqual({ itemizedTotal: 41500, unitemized: 18500, overItemizedBy: 0 });
  });

  it("reports over-itemization instead of clamping", () => {
    const summary = summarizeItemization(1000, [line({ amount: 1500 })]);
    expect(summary).toEqual({ itemizedTotal: 1500, unitemized: 0, overItemizedBy: 500 });
  });

  it("never produces negative components", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000_000 }),
        fc.array(fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }), { maxLength: 20 }),
        (transactionAmount, amounts) => {
          const summary = summarizeItemization(
            transactionAmount,
            amounts.map((amount) => line({ amount })),
          );
          expect(summary.itemizedTotal).toBeGreaterThanOrEqual(0);
          expect(summary.unitemized).toBeGreaterThanOrEqual(0);
          expect(summary.overItemizedBy).toBeGreaterThanOrEqual(0);
          // Exactly one of unitemized / overItemizedBy is nonzero, and they
          // reconcile against the transaction amount.
          expect(summary.itemizedTotal - summary.overItemizedBy + summary.unitemized).toBe(
            transactionAmount,
          );
        },
      ),
    );
  });
});
