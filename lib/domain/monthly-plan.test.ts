import { describe, expect, it } from "vitest";

import { summariseMonthlyPlan } from "@/lib/domain/monthly-plan";
import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { RecurringEvaluation } from "@/lib/domain/recurring";

function envelope(categoryId: string, allocated: number, rollover = 0): BudgetEnvelope {
  return {
    budgetId: `b:${categoryId}`,
    categoryId,
    categoryName: categoryId,
    allocated,
    rollover,
    spent: 0,
    remaining: allocated + rollover,
    isOverspent: false,
  };
}

function bill(
  categoryId: string,
  expectedAmount: number,
  matchedAmount = 0,
  state: RecurringEvaluation["state"] = "missing",
): RecurringEvaluation {
  return {
    obligation: { id: `o:${categoryId}`, categoryId, expectedAmount } as never,
    matchedTransactions: [],
    matchedAmount,
    expectedAmount,
    state,
  };
}

describe("summariseMonthlyPlan", () => {
  it("adds budgets to the bills no budget already covers", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [envelope("food", 300_000)],
      evaluations: [bill("rent", 600_000)],
      income: 1_200_000,
    });

    expect(summary).toMatchObject({
      budgeted: 300_000,
      billsOutstanding: 600_000,
      billsOutsideBudgets: 600_000,
      spokenFor: 900_000,
      unspokenFor: 300_000,
      overcommitted: false,
    });
  });

  it("counts a budgeted bill once, not twice", () => {
    // Rent is budgeted and also a recurring bill. The budget already claims it.
    const summary = summariseMonthlyPlan({
      envelopes: [envelope("rent", 600_000)],
      evaluations: [bill("rent", 600_000)],
      income: 1_200_000,
    });

    expect(summary.billsOutstanding).toBe(600_000);
    expect(summary.billsOutsideBudgets).toBe(0);
    expect(summary.spokenFor).toBe(600_000);
  });

  it("counts rollover as part of what is budgeted", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [envelope("food", 300_000, 50_000)],
      evaluations: [],
      income: 1_000_000,
    });

    expect(summary.budgeted).toBe(350_000);
  });

  it("leaves a paid bill out of what is still owed", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [],
      evaluations: [bill("rent", 600_000, 600_000, "paid")],
      income: 1_000_000,
    });

    expect(summary.billsOutstanding).toBe(0);
    expect(summary.spokenFor).toBe(0);
  });

  it("trusts a bill marked paid even when the amount matched is lower", () => {
    // Rent settled for less than expected still counts as settled, so the
    // difference is not money the month still owes.
    const summary = summariseMonthlyPlan({
      envelopes: [],
      evaluations: [bill("rent", 600_000, 550_000, "paid")],
      income: 1_000_000,
    });

    expect(summary.billsOutstanding).toBe(0);
  });

  it("counts only the unpaid part of a bill half settled", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [],
      evaluations: [bill("rent", 600_000, 250_000, "partial")],
      income: 1_000_000,
    });

    expect(summary.billsOutstanding).toBe(350_000);
  });

  it("never treats an overpaid bill as money owed back", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [],
      evaluations: [bill("rent", 600_000, 700_000, "partial")],
      income: 1_000_000,
    });

    expect(summary.billsOutstanding).toBe(0);
  });

  it("says when the plan outruns the money", () => {
    const summary = summariseMonthlyPlan({
      envelopes: [envelope("food", 900_000)],
      evaluations: [bill("rent", 600_000)],
      income: 1_200_000,
    });

    expect(summary.unspokenFor).toBe(-300_000);
    expect(summary.overcommitted).toBe(true);
  });

  it("does not call a month overcommitted before any income is recorded", () => {
    // Nothing has come in yet, which is not the same as spending too much.
    const summary = summariseMonthlyPlan({
      envelopes: [envelope("food", 900_000)],
      evaluations: [],
      income: 0,
    });

    expect(summary.overcommitted).toBe(false);
  });
});
