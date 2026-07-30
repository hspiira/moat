import { describe, expect, it } from "vitest";

import type { RecurringObligation } from "@/lib/types";
import type { RecurringEvaluation } from "@/lib/domain/recurring";

import { getBillDueState, getRecurringSections } from "./recurring-groups";

function obligation(values: Partial<RecurringObligation> = {}): RecurringObligation {
  return {
    id: "ob:1",
    userId: "u1",
    name: "Rent",
    type: "rent",
    categoryId: "cat:rent",
    expectedAmount: 500_000,
    cadence: "monthly",
    dueDay: 1,
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...values,
  };
}

function evaluation(
  values: Partial<RecurringEvaluation> & { obligation?: RecurringObligation } = {},
): RecurringEvaluation {
  const ob = values.obligation ?? obligation();
  return {
    obligation: ob,
    matchedTransactions: [],
    matchedAmount: 0,
    expectedAmount: ob.expectedAmount,
    state: "missing",
    ...values,
  };
}

describe("getBillDueState", () => {
  it("reads the day of the month a bill falls due", () => {
    expect(getBillDueState(obligation({ dueDay: 5 }), "2026-07-03")).toMatchObject({
      dueDay: 5,
      isOverdue: false,
    });
  });

  it("counts a bill as overdue once its day has passed unpaid", () => {
    expect(getBillDueState(obligation({ dueDay: 5 }), "2026-07-09").isOverdue).toBe(true);
  });

  it("is not overdue on the due day itself", () => {
    expect(getBillDueState(obligation({ dueDay: 9 }), "2026-07-09").isOverdue).toBe(false);
  });

  it("labels the day with an ordinal so a row reads as a date", () => {
    expect(getBillDueState(obligation({ dueDay: 1 }), "2026-07-01").label).toBe("Due 1st");
    expect(getBillDueState(obligation({ dueDay: 2 }), "2026-07-01").label).toBe("Due 2nd");
    expect(getBillDueState(obligation({ dueDay: 3 }), "2026-07-01").label).toBe("Due 3rd");
    expect(getBillDueState(obligation({ dueDay: 11 }), "2026-07-01").label).toBe("Due 11th");
    expect(getBillDueState(obligation({ dueDay: 22 }), "2026-07-01").label).toBe("Due 22nd");
  });

  it("says nothing about a day when the bill has none", () => {
    expect(getBillDueState(obligation({ dueDay: undefined }), "2026-07-09")).toMatchObject({
      dueDay: null,
      isOverdue: false,
      label: null,
    });
  });
});

describe("getRecurringSections", () => {
  it("separates what still needs paying from what is settled", () => {
    const sections = getRecurringSections({
      evaluations: [
        evaluation({ obligation: obligation({ id: "ob:paid", name: "Rent" }), state: "paid" }),
        evaluation({ obligation: obligation({ id: "ob:part", name: "Water" }), state: "partial" }),
        evaluation({ obligation: obligation({ id: "ob:miss", name: "School" }), state: "missing" }),
      ],
      obligations: [],
      today: "2026-07-09",
    });

    expect(sections.outstanding.map((entry) => entry.obligation.name)).toEqual(["Water", "School"]);
    expect(sections.paid.map((entry) => entry.obligation.name)).toEqual(["Rent"]);
  });

  it("surfaces paused bills so they can be resumed", () => {
    // evaluateRecurringObligations only evaluates active bills, so a paused one
    // vanished from the UI entirely — along with its own Resume button.
    const paused = obligation({ id: "ob:paused", name: "Gym", status: "paused" });
    const sections = getRecurringSections({
      evaluations: [],
      obligations: [obligation({ id: "ob:active" }), paused],
      today: "2026-07-09",
    });

    expect(sections.paused.map((entry) => entry.name)).toEqual(["Gym"]);
  });

  it("never lists an active bill as paused", () => {
    const sections = getRecurringSections({
      evaluations: [evaluation()],
      obligations: [obligation()],
      today: "2026-07-09",
    });
    expect(sections.paused).toEqual([]);
  });

  it("puts overdue bills before those not yet due", () => {
    const sections = getRecurringSections({
      evaluations: [
        evaluation({
          obligation: obligation({ id: "ob:later", name: "Later", dueDay: 28 }),
          state: "missing",
        }),
        evaluation({
          obligation: obligation({ id: "ob:overdue", name: "Overdue", dueDay: 2 }),
          state: "missing",
        }),
      ],
      obligations: [],
      today: "2026-07-09",
    });

    expect(sections.outstanding.map((entry) => entry.obligation.name)).toEqual([
      "Overdue",
      "Later",
    ]);
  });

  it("totals what is still owed across outstanding bills", () => {
    const sections = getRecurringSections({
      evaluations: [
        evaluation({
          obligation: obligation({ id: "a", expectedAmount: 100_000 }),
          expectedAmount: 100_000,
          matchedAmount: 40_000,
          state: "partial",
        }),
        evaluation({
          obligation: obligation({ id: "b", expectedAmount: 50_000 }),
          expectedAmount: 50_000,
          matchedAmount: 0,
          state: "missing",
        }),
      ],
      obligations: [],
      today: "2026-07-09",
    });

    // 60,000 still owed on the partial, plus the whole 50,000.
    expect(sections.outstandingTotal).toBe(110_000);
  });
});
