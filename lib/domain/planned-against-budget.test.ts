import { describe, expect, it } from "vitest";

import { comparePlannedWithBudget } from "@/lib/domain/planned-against-budget";
import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { Item, PlannedPurchase } from "@/lib/types";

const STAMP = "2026-08-01T00:00:00.000Z";

function item(id: string, categoryId?: string): Item {
  return {
    id,
    userId: "user:default",
    name: id,
    normalizedName: id,
    defaultCategoryId: categoryId,
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function purchase(overrides: Partial<PlannedPurchase> & { itemId: string }): PlannedPurchase {
  return {
    id: `planned:${overrides.itemId}`,
    userId: "user:default",
    status: "planned",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

function envelope(categoryId: string, remaining: number): BudgetEnvelope {
  return {
    budgetId: `budget:${categoryId}`,
    categoryId,
    categoryName: categoryId === "category:food" ? "Food" : "Household",
    allocated: 100_000,
    rollover: 0,
    spent: 100_000 - remaining,
    remaining,
    isOverspent: remaining < 0,
  };
}

describe("comparePlannedWithBudget", () => {
  it("says when the plan does not fit what is left", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "rice", estimatedUnitPrice: 30_000 })],
      items: [item("rice", "category:food")],
      envelopes: [envelope("category:food", 12_000)],
    });

    expect(result[0]).toMatchObject({ planned: 30_000, remaining: 12_000, shortfall: 18_000 });
  });

  it("says nothing is short when it fits", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "rice", estimatedUnitPrice: 8_000 })],
      items: [item("rice", "category:food")],
      envelopes: [envelope("category:food", 12_000)],
    });

    expect(result[0].shortfall).toBe(0);
  });

  it("prices from what you last paid when you typed nothing", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "rice", quantity: 2 })],
      items: [item("rice", "category:food")],
      envelopes: [envelope("category:food", 12_000)],
      lastPaidFor: () => 8_000,
    });

    expect(result[0].planned).toBe(16_000);
  });

  it("leaves out an item whose category it has not learned", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "salt", estimatedUnitPrice: 2_000 })],
      items: [item("salt")],
      envelopes: [envelope("category:food", 12_000)],
    });

    expect(result).toEqual([]);
  });

  it("leaves out a category with no budget to compare against", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "soap", estimatedUnitPrice: 5_000 })],
      items: [item("soap", "category:household")],
      envelopes: [envelope("category:food", 12_000)],
    });

    expect(result).toEqual([]);
  });

  it("counts nothing for what is already bought", () => {
    const result = comparePlannedWithBudget({
      purchases: [purchase({ itemId: "rice", estimatedUnitPrice: 30_000, status: "purchased" })],
      items: [item("rice", "category:food")],
      envelopes: [envelope("category:food", 12_000)],
    });

    expect(result).toEqual([]);
  });

  it("puts the worst shortfall first", () => {
    const result = comparePlannedWithBudget({
      purchases: [
        purchase({ itemId: "rice", estimatedUnitPrice: 15_000 }),
        purchase({ itemId: "soap", estimatedUnitPrice: 40_000 }),
      ],
      items: [item("rice", "category:food"), item("soap", "category:household")],
      envelopes: [envelope("category:food", 12_000), envelope("category:household", 5_000)],
    });

    expect(result.map((entry) => entry.categoryId)).toEqual([
      "category:household",
      "category:food",
    ]);
  });
});
