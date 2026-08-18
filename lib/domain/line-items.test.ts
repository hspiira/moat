import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  lineItemAmount,
  resolveLineItemDraft,
  summarizeItemization,
} from "@/lib/domain/line-items";
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
          expect(summary.itemizedTotal - summary.overItemizedBy + summary.unitemized).toBe(
            transactionAmount,
          );
        },
      ),
    );
  });
});

describe("resolveLineItemDraft", () => {
  it("computes the amount from quantity and unit price", () => {
    expect(
      resolveLineItemDraft({ quantity: 2, unitPrice: 6000 }, ["unitPrice", "quantity"]),
    ).toEqual({ quantity: 2, unitPrice: 6000, amount: 12000, derived: "amount" });
  });

  it("back-solves the unit price when you know the line total", () => {
    expect(
      resolveLineItemDraft({ quantity: 2, amount: 12000 }, ["amount", "quantity"]),
    ).toEqual({ quantity: 2, unitPrice: 6000, amount: 12000, derived: "unitPrice" });
  });

  it("back-solves the quantity from a unit price and a total", () => {
    expect(
      resolveLineItemDraft({ unitPrice: 6000, amount: 12000 }, ["amount", "unitPrice"]),
    ).toEqual({ quantity: 2, unitPrice: 6000, amount: 12000, derived: "quantity" });
  });

  it("lets the two most recently touched fields win once all three are filled", () => {
    expect(
      resolveLineItemDraft(
        { quantity: 2, unitPrice: 9999, amount: 12000 },
        ["amount", "quantity", "unitPrice"],
      ),
    ).toEqual({ quantity: 2, unitPrice: 6000, amount: 12000, derived: "unitPrice" });
  });

  it("derives nothing from a single value", () => {
    expect(resolveLineItemDraft({ quantity: 2 }, ["quantity"])).toEqual({
      quantity: 2,
      unitPrice: undefined,
      amount: undefined,
      derived: null,
    });
  });

  it("derives nothing from an empty draft", () => {
    expect(resolveLineItemDraft({}, [])).toEqual({
      quantity: undefined,
      unitPrice: undefined,
      amount: undefined,
      derived: null,
    });
  });

  it("refuses to divide by zero", () => {
    expect(
      resolveLineItemDraft({ quantity: 0, amount: 12000 }, ["amount", "quantity"]),
    ).toMatchObject({ unitPrice: undefined, derived: null });
  });

  it("keeps a zero total honest rather than back-solving a zero unit price away", () => {
    expect(
      resolveLineItemDraft({ quantity: 2, amount: 0 }, ["amount", "quantity"]),
    ).toMatchObject({ unitPrice: 0, derived: "unitPrice" });
  });

  it("ignores fields the user never touched", () => {
    expect(
      resolveLineItemDraft({ quantity: 3, unitPrice: 500, amount: 3000 }, ["amount", "quantity"]),
    ).toMatchObject({ unitPrice: 1000, derived: "unitPrice" });
  });

  it("always returns three values that multiply out", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 2_000_000 }),
        (quantity, unitPrice) => {
          const resolved = resolveLineItemDraft({ quantity, unitPrice }, [
            "unitPrice",
            "quantity",
          ]);
          expect(resolved.quantity! * resolved.unitPrice!).toBe(resolved.amount);
        },
      ),
    );
  });
});
