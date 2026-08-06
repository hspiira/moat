import { describe, expect, it } from "vitest";

import {
  buildDailyNetCalendar,
  buildPositionSeries,
  formatCompactAmount,
  getAllocation,
  getFlowBreakdown,
} from "@/lib/domain/report";
import type { Account, Transaction } from "@/lib/types";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    userId: "u1",
    name: "Cash",
    type: "cash",
    balance: 0,
    openingBalance: 100_000,
    currency: "UGX",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Account;
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    userId: "u1",
    accountId: "a1",
    categoryId: "c1",
    type: "expense",
    amount: 10_000,
    occurredOn: "2026-08-01",
    note: "",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  } as Transaction;
}

const NOW = new Date(2026, 7, 7);

describe("buildPositionSeries", () => {
  it("returns one point per day for the window", () => {
    const series = buildPositionSeries([account()], [], 7, NOW);

    expect(series.points).toHaveLength(7);
    expect(series.points[0].date).toBe("2026-08-01");
    expect(series.points[6].date).toBe("2026-08-07");
  });

  it("walks the opening balance forward through daily deltas", () => {
    const series = buildPositionSeries(
      [account()],
      [
        transaction({ type: "income", amount: 50_000, occurredOn: "2026-08-02" }),
        transaction({ type: "expense", amount: 20_000, occurredOn: "2026-08-04" }),
      ],
      7,
      NOW,
    );

    expect(series.points[0].balance).toBe(100_000);
    expect(series.points[1].balance).toBe(150_000);
    expect(series.points[3].balance).toBe(130_000);
    expect(series.points[6].balance).toBe(130_000);
    expect(series.change).toBe(30_000);
  });

  it("seeds the window with movement that happened before it", () => {
    const series = buildPositionSeries(
      [account()],
      [transaction({ type: "income", amount: 40_000, occurredOn: "2026-07-01" })],
      7,
      NOW,
    );

    expect(series.points[0].balance).toBe(140_000);
    expect(series.change).toBe(0);
  });
});

describe("buildDailyNetCalendar", () => {
  it("produces a cell for every day of the month", () => {
    const cells = buildDailyNetCalendar([], "2026-08");
    expect(cells).toHaveLength(31);
    expect(cells[0].date).toBe("2026-08-01");
    expect(cells[30].date).toBe("2026-08-31");
  });

  it("distinguishes a zero-net day with activity from a quiet day", () => {
    const cells = buildDailyNetCalendar(
      [
        transaction({ type: "income", amount: 5_000, occurredOn: "2026-08-03" }),
        transaction({ type: "expense", amount: 5_000, occurredOn: "2026-08-03" }),
      ],
      "2026-08",
    );

    expect(cells[2].net).toBe(0);
    expect(cells[2].hasActivity).toBe(true);
    expect(cells[3].hasActivity).toBe(false);
  });
});

describe("getFlowBreakdown", () => {
  it("splits totals and counts by direction, ignoring transfers", () => {
    const breakdown = getFlowBreakdown([
      transaction({ type: "income", amount: 100_000 }),
      transaction({ type: "expense", amount: 30_000 }),
      transaction({ type: "savings_contribution", amount: 20_000 }),
      transaction({ type: "transfer", amount: 15_000 }),
    ]);

    expect(breakdown).toEqual({
      inflow: 100_000,
      inflowCount: 1,
      outflow: 50_000,
      outflowCount: 2,
    });
  });
});

describe("formatCompactAmount", () => {
  it.each([
    [850, "850"],
    [45_000, "45k"],
    [1_200_000, "1.2M"],
    [12_000_000, "12M"],
    [-45_000, "45k"],
  ])("formats %d as %s", (amount, expected) => {
    expect(formatCompactAmount(amount)).toBe(expected);
  });
});

describe("getAllocation", () => {
  it("shares out positive holdings by account type", () => {
    const slices = getAllocation([
      account({ id: "a1", type: "cash", balance: 30_000 }),
      account({ id: "a2", type: "bank", balance: 70_000 }),
    ]);

    expect(slices.map((slice) => [slice.key, slice.share])).toEqual([
      ["bank", 0.7],
      ["cash", 0.3],
    ]);
  });

  it("sums accounts that share a type", () => {
    const slices = getAllocation([
      account({ id: "a1", type: "cash", balance: 10_000 }),
      account({ id: "a2", type: "cash", balance: 30_000 }),
    ]);

    expect(slices).toHaveLength(1);
    expect(slices[0].amount).toBe(40_000);
  });

  it("leaves out claims and archived or empty accounts", () => {
    const slices = getAllocation([
      account({ id: "a1", type: "cash", balance: 50_000 }),
      account({ id: "a2", type: "debt", balance: -80_000 }),
      account({ id: "a3", type: "receivable", balance: 20_000 }),
      account({ id: "a4", type: "bank", balance: 0 }),
      account({ id: "a5", type: "sacco", balance: 10_000, isArchived: true }),
    ]);

    expect(slices).toHaveLength(1);
    expect(slices[0].key).toBe("cash");
    expect(slices[0].share).toBe(1);
  });

  it("returns nothing when there is nothing held", () => {
    expect(getAllocation([])).toEqual([]);
  });
});
