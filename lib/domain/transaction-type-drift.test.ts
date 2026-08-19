import { describe, expect, it } from "vitest";

import { findTransactionTypeDrift } from "@/lib/domain/transaction-type-drift";
import type { Category, Transaction } from "@/lib/types";

const TIMESTAMP = "2026-08-17T00:00:00.000Z";

const category = (id: string, kind: Category["kind"]): Category => ({
  id,
  userId: "u1",
  name: id,
  kind,
  isDefault: true,
  createdAt: TIMESTAMP,
});

const transaction = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
  userId: "u1",
  accountId: "account:1",
  type: "expense",
  amount: 1000,
  currency: "UGX",
  originalAmount: 1000,
  occurredOn: "2026-08-17",
  categoryId: "category:food",
  reconciliationState: "posted",
  source: "manual",
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
});

describe("findTransactionTypeDrift", () => {
  it("leaves a row whose type already matches its category", () => {
    const drift = findTransactionTypeDrift(
      [transaction({ id: "t:1" })],
      [category("category:food", "expense")],
      TIMESTAMP,
    );
    expect(drift).toEqual({ repaired: [], needsReview: [] });
  });

  it("repairs an expense filed under a debt repayment category", () => {
    const drift = findTransactionTypeDrift(
      [transaction({ id: "t:1", categoryId: "category:debt-repayment" })],
      [category("category:debt-repayment", "debt_repayment")],
      TIMESTAMP,
    );

    expect(drift.needsReview).toEqual([]);
    expect(drift.repaired).toHaveLength(1);
    expect(drift.repaired[0].type).toBe("debt_payment");
    expect(drift.repaired[0].amount).toBe(1000);
  });

  it("refuses to turn a single row into a transfer", () => {
    const drift = findTransactionTypeDrift(
      [transaction({ id: "t:1", categoryId: "category:lending" })],
      [category("category:lending", "lending")],
      TIMESTAMP,
    );

    expect(drift.repaired).toEqual([]);
    expect(drift.needsReview.map((entry) => entry.id)).toEqual(["t:1"]);
  });

  it("refuses a repair that would move money", () => {
    const drift = findTransactionTypeDrift(
      [transaction({ id: "t:1", type: "expense", categoryId: "category:salary" })],
      [category("category:salary", "income")],
      TIMESTAMP,
    );

    expect(drift.repaired).toEqual([]);
    expect(drift.needsReview.map((entry) => entry.id)).toEqual(["t:1"]);
  });

  it("ignores a row whose category is gone", () => {
    const drift = findTransactionTypeDrift([transaction({ id: "t:1" })], [], TIMESTAMP);
    expect(drift).toEqual({ repaired: [], needsReview: [] });
  });

  it("sends an expense carrying a savings category to review rather than repairing it", () => {
    const drift = findTransactionTypeDrift(
      [transaction({ id: "t:1", type: "expense", categoryId: "category:savings" })],
      [category("category:savings", "savings")],
      TIMESTAMP,
    );

    expect(drift.repaired).toEqual([]);
    expect(drift.needsReview.map((entry) => entry.id)).toEqual(["t:1"]);
  });
});
