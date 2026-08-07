import { describe, expect, it } from "vitest";

import { getAttentionItems, getBillsDueSoon } from "@/lib/domain/attention";
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

describe("getBillsDueSoon", () => {
  const evaluation = (overrides: Record<string, unknown> = {}) => ({
    obligation: {
      id: "ob1",
      name: "Rent",
      type: "rent",
      categoryId: "c1",
      expectedAmount: 500_000,
      cadence: "monthly",
      dueDay: 10,
      status: "active",
      ...(overrides.obligation as Record<string, unknown> | undefined),
    },
    matchedTransactions: [],
    matchedAmount: 0,
    expectedAmount: 500_000,
    state: "missing",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  it("lists an unpaid bill due within the window", () => {
    const [item] = getBillsDueSoon([evaluation()], new Date(2026, 7, 7));

    expect(item.title).toBe("Rent is due in 3 days");
    expect(item.body).toContain("500,000");
    expect(item.href).toBe("/recurring");
  });

  it("keeps an overdue bill listed until paid", () => {
    const [item] = getBillsDueSoon([evaluation()], new Date(2026, 7, 20));

    expect(item.title).toBe("Rent was due on the 10th");
  });

  it("says nothing about a paid bill", () => {
    expect(
      getBillsDueSoon([evaluation({ state: "paid" })], new Date(2026, 7, 9)),
    ).toEqual([]);
  });

  it("ignores bills whose due day is still far off", () => {
    expect(
      getBillsDueSoon([evaluation()], new Date(2026, 7, 1)),
    ).toEqual([]);
  });

  it("reports the remaining amount when partially paid", () => {
    const [item] = getBillsDueSoon(
      [evaluation({ matchedAmount: 300_000, state: "partial" })],
      new Date(2026, 7, 9),
    );

    expect(item.body).toContain("200,000");
  });
});
