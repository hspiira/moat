import { describe, expect, it } from "vitest";

import type { BudgetEnvelope } from "@/lib/domain/budgets";
import { describeBillTiming, getPlanPreview } from "@/lib/domain/plan-preview";
import type { RecurringEvaluation, RecurringMatchState } from "@/lib/domain/recurring";
import type { RecurringObligation } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-09-01T00:00:00.000Z";
// The 10th, so a bill on the 4th is overdue and one on the 14th is upcoming.
const TODAY = new Date(2026, 8, 10, 9, 0);

function bill(
  name: string,
  dueDay: number | undefined,
  state: RecurringMatchState = "missing",
): RecurringEvaluation {
  const obligation: RecurringObligation = {
    id: `bill:${name}`,
    userId: USER,
    name,
    type: "rent",
    categoryId: "cat:bills",
    expectedAmount: 100_000,
    cadence: "monthly",
    dueDay,
    status: "active",
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  return {
    obligation,
    matchedTransactions: [],
    matchedAmount: state === "paid" ? 100_000 : 0,
    expectedAmount: 100_000,
    state,
  };
}

function envelope(categoryName: string, isOverspent: boolean): BudgetEnvelope {
  return {
    budgetId: `budget:${categoryName}`,
    categoryId: `cat:${categoryName}`,
    categoryName,
    allocated: 200_000,
    rollover: 0,
    spent: isOverspent ? 250_000 : 50_000,
    remaining: isOverspent ? -50_000 : 150_000,
    isOverspent,
  };
}

describe("getPlanPreview", () => {
  it("names the most urgent unpaid bill", () => {
    const preview = getPlanPreview({
      evaluations: [bill("Internet", 14), bill("Rent", 12)],
      envelopes: [],
      today: TODAY,
    });

    expect(preview.nextBill).toEqual({ name: "Rent", daysLeft: 2 });
  });

  // A bill you have already missed outranks one still to come.
  it("puts an overdue bill ahead of an upcoming one", () => {
    const preview = getPlanPreview({
      evaluations: [bill("Rent", 12), bill("Water", 4)],
      envelopes: [],
      today: TODAY,
    });

    expect(preview.nextBill).toEqual({ name: "Water", daysLeft: -6 });
  });

  it("leaves a paid bill out of the count and out of the headline", () => {
    const preview = getPlanPreview({
      evaluations: [bill("Water", 4, "paid"), bill("Rent", 12)],
      envelopes: [],
      today: TODAY,
    });

    expect(preview.nextBill?.name).toBe("Rent");
    expect(preview.billsOutstanding).toBe(1);
  });

  it("still counts a bill with no due day, but cannot headline it", () => {
    const preview = getPlanPreview({
      evaluations: [bill("Airtime", undefined)],
      envelopes: [],
      today: TODAY,
    });

    expect(preview.nextBill).toBeNull();
    expect(preview.billsOutstanding).toBe(1);
  });

  it("shows only the unpaid remainder, without subtracting overpayments", () => {
    const partial = { ...bill("Rent", 12, "partial"), matchedAmount: 40_000 };
    const overpaid = { ...bill("Internet", 14, "paid"), matchedAmount: 120_000 };
    const preview = getPlanPreview({ evaluations: [partial, overpaid], envelopes: [], today: TODAY });
    expect(preview.outstandingAmount).toBe(60_000);
    expect(preview.hasBills).toBe(true);
    expect(getPlanPreview({ evaluations: [], envelopes: [], today: TODAY }).hasBills).toBe(false);
  });

  it("counts the budgets that are already overspent", () => {
    const preview = getPlanPreview({
      evaluations: [],
      envelopes: [envelope("Food", true), envelope("Transport", false), envelope("Fun", true)],
      today: TODAY,
    });

    expect(preview.overspentBudgets).toBe(2);
  });

  // Nothing planned is different from a plan with nothing outstanding, and the
  // card says something different in each case.
  it("reports an empty plan as having no plan", () => {
    expect(getPlanPreview({ evaluations: [], envelopes: [], today: TODAY }).hasPlan).toBe(false);
    expect(
      getPlanPreview({ evaluations: [], envelopes: [envelope("Food", false)], today: TODAY })
        .hasPlan,
    ).toBe(true);
  });
});

describe("describeBillTiming", () => {
  it("reads naturally on both sides of the due date", () => {
    expect(describeBillTiming(-6)).toBe("6 days overdue");
    expect(describeBillTiming(-1)).toBe("1 day overdue");
    expect(describeBillTiming(0)).toBe("due today");
    expect(describeBillTiming(1)).toBe("due tomorrow");
    expect(describeBillTiming(4)).toBe("due in 4 days");
  });
});
