import { describe, expect, it } from "vitest";

import { getGoalPace } from "@/lib/domain/goal-pace";
import type { Category, Goal, Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";
const NOW = new Date(2026, 7, 20, 12, 0);

const categories: Category[] = [
  {
    id: "cat:savings",
    userId: USER,
    name: "Savings",
    kind: "savings",
    isDefault: true,
    createdAt: STAMP,
  },
];

const schoolFees: Goal = {
  id: "goal:fees",
  userId: USER,
  name: "School fees",
  goalType: "school_fees",
  targetAmount: 1_200_000,
  currentAmount: 0,
  targetDate: "2027-02-01",
  priority: 1,
  linkedAccountId: "acc:sacco",
  createdAt: STAMP,
  updatedAt: STAMP,
};

function deposit(occurredOn: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `dep:${occurredOn}:${amount}`,
    userId: USER,
    accountId: "acc:sacco",
    type: "transfer",
    amount,
    currency: "UGX",
    originalAmount: amount,
    occurredOn,
    categoryId: "cat:savings",
    reconciliationState: "posted",
    source: "manual",
    transferGroupId: `g:${occurredOn}`,
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
    ...overrides,
  };
}

describe("getGoalPace", () => {
  it("works out what the goal needs each month", () => {
    const [pace] = getGoalPace({ goals: [schoolFees], transactions: [], categories, now: NOW });

    // August through February inclusive is seven months for 1,200,000.
    expect(pace.monthsRemaining).toBe(7);
    expect(pace.requiredMonthly).toBe(171_429);
  });

  it("counts what arrived this month and reports the gap", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [deposit("2026-08-05", 120_000)],
      categories,
      now: NOW,
    });

    expect(pace.contributedThisMonth).toBe(120_000);
    expect(pace.shortfall).toBe(51_429);
  });

  it("reports no gap once the month is covered", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [deposit("2026-08-05", 200_000)],
      categories,
      now: NOW,
    });

    expect(pace.shortfall).toBe(0);
  });

  it("ignores what went in last month", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [deposit("2026-07-05", 500_000)],
      categories,
      now: NOW,
    });

    expect(pace.contributedThisMonth).toBe(0);
  });

  it("ignores money that arrived somewhere else", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [deposit("2026-08-05", 200_000, { accountId: "acc:other" })],
      categories,
      now: NOW,
    });

    expect(pace.contributedThisMonth).toBe(0);
  });

  it("ignores the leg that leaves, which is the same money going out", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [deposit("2026-08-05", -200_000)],
      categories,
      now: NOW,
    });

    expect(pace.contributedThisMonth).toBe(0);
  });

  it("still counts a contribution recorded before savings became a transfer", () => {
    const [pace] = getGoalPace({
      goals: [schoolFees],
      transactions: [
        deposit("2026-08-05", 150_000, { type: "savings_contribution", transferGroupId: undefined }),
      ],
      categories,
      now: NOW,
    });

    expect(pace.contributedThisMonth).toBe(150_000);
  });

  it("skips a goal with no account to watch", () => {
    expect(
      getGoalPace({
        goals: [{ ...schoolFees, linkedAccountId: undefined }],
        transactions: [],
        categories,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("skips a goal already met", () => {
    expect(
      getGoalPace({
        goals: [{ ...schoolFees, currentAmount: 1_200_000 }],
        transactions: [],
        categories,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("puts the widest gap first", () => {
    const smaller: Goal = {
      ...schoolFees,
      id: "goal:phone",
      name: "Phone",
      targetAmount: 600_000,
      linkedAccountId: "acc:sacco",
    };

    const paces = getGoalPace({
      goals: [smaller, schoolFees],
      transactions: [],
      categories,
      now: NOW,
    });

    expect(paces.map((pace) => pace.goal.name)).toEqual(["School fees", "Phone"]);
  });
});
