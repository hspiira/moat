import { describe, expect, it } from "vitest";

import { getIncomeStability } from "@/lib/domain/income-stability";
import type { Transaction } from "@/lib/types";

const USER = "user:ada";
const NOW = new Date(2026, 7, 20, 12, 0);

function income(occurredOn: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `in:${occurredOn}:${amount}`,
    userId: USER,
    accountId: "acc:bank",
    type: "income",
    amount,
    currency: "UGX",
    originalAmount: amount,
    occurredOn,
    categoryId: "cat:salary",
    reconciliationState: "posted",
    source: "manual",
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
    ...overrides,
  };
}

const swinging = [
  income("2026-02-28", 900_000),
  income("2026-03-31", 400_000),
  income("2026-04-30", 1_200_000),
  income("2026-05-31", 600_000),
  income("2026-06-30", 800_000),
  income("2026-07-31", 700_000),
];

describe("getIncomeStability", () => {
  it("reports the worst month, the best, and the middle", () => {
    const stability = getIncomeStability({ transactions: swinging, now: NOW })!;

    expect(stability.lowest).toEqual({ month: "2026-03", total: 400_000 });
    expect(stability.highest).toEqual({ month: "2026-04", total: 1_200_000 });
    expect(stability.median).toBe(750_000);
  });

  it("measures the swing against the middle month", () => {
    const stability = getIncomeStability({ transactions: swinging, now: NOW })!;

    expect(stability.swing).toBeCloseTo((1_200_000 - 400_000) / 750_000);
  });

  it("leaves the month in progress out, since it is not finished", () => {
    const stability = getIncomeStability({
      transactions: [...swinging, income("2026-08-05", 10_000)],
      now: NOW,
    })!;

    expect(stability.months.map((entry) => entry.month)).not.toContain("2026-08");
    expect(stability.lowest.total).toBe(400_000);
  });

  it("needs three finished months before it says anything", () => {
    expect(
      getIncomeStability({ transactions: swinging.slice(0, 2), now: NOW }),
    ).toBeNull();
  });

  it("skips a month with no income rather than calling it a zero month", () => {
    const stability = getIncomeStability({
      transactions: [
        income("2026-05-31", 600_000),
        income("2026-06-30", 800_000),
        income("2026-07-31", 700_000),
      ],
      now: NOW,
    })!;

    expect(stability.months).toHaveLength(3);
    expect(stability.lowest.total).toBe(600_000);
  });

  it("counts only income, not spending", () => {
    const stability = getIncomeStability({
      transactions: [
        ...swinging,
        income("2026-06-15", 5_000_000, { type: "expense", id: "spend" }),
      ],
      now: NOW,
    })!;

    expect(stability.highest.total).toBe(1_200_000);
  });

  it("reads a window that crosses a year boundary", () => {
    const stability = getIncomeStability({
      transactions: [
        income("2025-11-30", 300_000),
        income("2025-12-31", 500_000),
        income("2026-01-31", 400_000),
      ],
      now: new Date(2026, 1, 10, 12, 0),
      monthsBack: 6,
    })!;

    expect(stability.months.map((entry) => entry.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
  });

  it("has no swing to report when every month is identical", () => {
    const flat = ["2026-05-31", "2026-06-30", "2026-07-31"].map((day) =>
      income(day, 700_000),
    );

    expect(getIncomeStability({ transactions: flat, now: NOW })!.swing).toBe(0);
  });
});
