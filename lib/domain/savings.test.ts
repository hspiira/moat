import { describe, expect, it } from "vitest";

import {
  isSavingsAllocation,
  isSavingsDeposit,
  savingsCategoryIds,
  sumSavingsAllocated,
} from "@/lib/domain/savings";
import type { Category, Transaction } from "@/lib/types";

const CATEGORIES: Category[] = [
  {
    id: "category:savings",
    userId: "user:default",
    name: "Savings",
    kind: "savings",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "category:food",
    userId: "user:default",
    name: "Food",
    kind: "expense",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
];

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "tx:1",
    userId: "user:default",
    accountId: "account:bank",
    type: "transfer",
    amount: -100_000,
    currency: "UGX",
    originalAmount: 100_000,
    occurredOn: "2026-04-10",
    categoryId: "category:savings",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

const savingsIds = savingsCategoryIds(CATEGORIES);

describe("savings allocation", () => {
  it("counts the leg that leaves the source account", () => {
    expect(isSavingsAllocation(transaction({}), savingsIds)).toBe(true);
  });

  it("does not count the leg that arrives, so a pair is not counted twice", () => {
    expect(isSavingsAllocation(transaction({ amount: 100_000 }), savingsIds)).toBe(false);
  });

  it("still counts a contribution recorded before savings became a transfer", () => {
    expect(
      isSavingsAllocation(
        transaction({ type: "savings_contribution", amount: 100_000 }),
        savingsIds,
      ),
    ).toBe(true);
  });

  it("leaves an ordinary transfer out of savings", () => {
    expect(
      isSavingsAllocation(transaction({ categoryId: "category:transfers" }), savingsIds),
    ).toBe(false);
  });

  it("reads the arriving leg as the deposit", () => {
    expect(isSavingsDeposit(transaction({ amount: 100_000 }), savingsIds)).toBe(true);
    expect(isSavingsDeposit(transaction({}), savingsIds)).toBe(false);
  });
});

describe("sumSavingsAllocated", () => {
  it("sums a balanced pair once", () => {
    const total = sumSavingsAllocated(
      [
        transaction({ id: "tx:out", amount: -400_000, transferGroupId: "g1" }),
        transaction({ id: "tx:in", amount: 400_000, transferGroupId: "g1" }),
      ],
      CATEGORIES,
    );

    expect(total).toBe(400_000);
  });

  it("adds a legacy single row to a new pair", () => {
    const total = sumSavingsAllocated(
      [
        transaction({ id: "tx:out", amount: -400_000, transferGroupId: "g1" }),
        transaction({ id: "tx:in", amount: 400_000, transferGroupId: "g1" }),
        transaction({ id: "tx:old", type: "savings_contribution", amount: 100_000 }),
      ],
      CATEGORIES,
    );

    expect(total).toBe(500_000);
  });

  it("counts nothing when no category is a savings category", () => {
    expect(
      sumSavingsAllocated([transaction({})], [CATEGORIES[1]]),
    ).toBe(0);
  });
});
