import { describe, expect, it } from "vitest";

import type { BudgetEnvelope } from "@/lib/domain/budgets";

import { getBudgetMonthPosition, getEnvelopeProgress } from "./budget-progress";

function envelope(values: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  const allocated = values.allocated ?? 100_000;
  const spent = values.spent ?? 0;
  return {
    budgetId: "budget:1",
    categoryId: "cat:food",
    categoryName: "Food",
    allocated,
    rollover: 0,
    spent,
    remaining: allocated - spent,
    isOverspent: allocated - spent < 0,
    ...values,
  };
}

describe("getEnvelopeProgress", () => {
  it("reports an untouched envelope as empty and on track", () => {
    expect(getEnvelopeProgress(envelope({ spent: 0 }))).toMatchObject({
      fraction: 0,
      status: "on_track",
      overspentBy: 0,
    });
  });

  it("reports the fraction spent", () => {
    expect(getEnvelopeProgress(envelope({ spent: 25_000 })).fraction).toBe(0.25);
  });

  it("warns once most of the envelope is gone", () => {
    expect(getEnvelopeProgress(envelope({ spent: 84_000 })).status).toBe("on_track");
    expect(getEnvelopeProgress(envelope({ spent: 85_000 })).status).toBe("near_limit");
    expect(getEnvelopeProgress(envelope({ spent: 100_000 })).status).toBe("near_limit");
  });

  it("reports overspending with the amount gone over", () => {
    const progress = getEnvelopeProgress(envelope({ spent: 130_000 }));
    expect(progress.status).toBe("overspent");
    expect(progress.overspentBy).toBe(30_000);
  });

  it("caps the bar at full so an overspent meter cannot overflow its track", () => {
    expect(getEnvelopeProgress(envelope({ spent: 400_000 })).fraction).toBe(1);
  });

  it("treats any spending against a zero allocation as overspent, not as divide-by-zero", () => {
    const progress = getEnvelopeProgress(envelope({ allocated: 0, spent: 5_000 }));
    expect(progress.fraction).toBe(1);
    expect(progress.status).toBe("overspent");
    expect(progress.overspentBy).toBe(5_000);
  });

  it("leaves an empty zero-allocation envelope on track rather than NaN", () => {
    const progress = getEnvelopeProgress(envelope({ allocated: 0, spent: 0 }));
    expect(progress.fraction).toBe(0);
    expect(progress.status).toBe("on_track");
  });
});

describe("getBudgetMonthPosition", () => {
  it("sums the month across envelopes", () => {
    const position = getBudgetMonthPosition(
      [
        envelope({ budgetId: "b1", allocated: 100_000, spent: 40_000 }),
        envelope({ budgetId: "b2", allocated: 50_000, spent: 20_000 }),
      ],
      { inflow: 300_000, allocated: 150_000, unallocatedIncome: 150_000 },
    );

    expect(position).toMatchObject({
      allocated: 150_000,
      spent: 60_000,
      remaining: 90_000,
      overspentCount: 0,
      unallocatedIncome: 150_000,
    });
  });

  it("counts how many envelopes are overspent", () => {
    const position = getBudgetMonthPosition(
      [
        envelope({ budgetId: "b1", allocated: 10_000, spent: 12_000 }),
        envelope({ budgetId: "b2", allocated: 10_000, spent: 30_000 }),
        envelope({ budgetId: "b3", allocated: 10_000, spent: 1_000 }),
      ],
      { inflow: 0, allocated: 30_000, unallocatedIncome: -30_000 },
    );

    expect(position.overspentCount).toBe(2);
  });

  it("reports an empty month without pretending anything is allocated", () => {
    const position = getBudgetMonthPosition([], {
      inflow: 0,
      allocated: 0,
      unallocatedIncome: 0,
    });
    expect(position).toMatchObject({ allocated: 0, spent: 0, remaining: 0, overspentCount: 0 });
  });
});
