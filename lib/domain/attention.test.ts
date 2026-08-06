import { describe, expect, it } from "vitest";

import { getAttentionItems } from "@/lib/domain/attention";
import type { BudgetEnvelope } from "@/lib/domain/budgets";

function envelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    budgetId: "b1",
    categoryId: "c1",
    categoryName: "Food",
    allocated: 100_000,
    rollover: 0,
    spent: 120_000,
    remaining: -20_000,
    isOverspent: true,
    ...overrides,
  };
}

describe("getAttentionItems", () => {
  it("returns nothing when there is nothing to act on", () => {
    expect(getAttentionItems({ envelopes: [], reviewCount: 0, insights: [] })).toEqual([]);
  });

  it("leaves budgets that are within their limit out of the list", () => {
    const items = getAttentionItems({
      envelopes: [envelope({ isOverspent: false, remaining: 20_000 })],
      reviewCount: 0,
      insights: [],
    });

    expect(items).toEqual([]);
  });

  it("orders overspends before the review queue, and both before insights", () => {
    const items = getAttentionItems({
      envelopes: [envelope()],
      reviewCount: 3,
      insights: [{ id: "i1", title: "Savings", body: "You saved more than last month." }],
    });

    expect(items.map((item) => item.id)).toEqual(["overspent:b1", "capture-review", "i1"]);
  });

  it("reports the overspend as a positive amount", () => {
    const [item] = getAttentionItems({
      envelopes: [envelope({ remaining: -20_000 })],
      reviewCount: 0,
      insights: [],
    });

    expect(item.body).toContain("20,000");
    expect(item.body).not.toContain("-");
  });

  it("singularises a lone capture", () => {
    const [item] = getAttentionItems({ envelopes: [], reviewCount: 1, insights: [] });

    expect(item.title).toBe("1 capture to review");
  });
});
