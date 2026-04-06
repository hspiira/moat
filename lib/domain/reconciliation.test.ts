import { describe, expect, it } from "vitest";

import { buildMonthCloseRecord, evaluateMonthClose } from "@/lib/domain/reconciliation";
import type { Category, RecurringObligation, Transaction } from "@/lib/types";

const categories: Category[] = [
  {
    id: "category:salary",
    userId: "user:default",
    name: "Salary",
    kind: "income",
    isDefault: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
];

function buildTransaction(
  values: Partial<Transaction> & Pick<Transaction, "id" | "accountId" | "type" | "amount" | "occurredOn" | "categoryId">,
): Transaction {
  return {
    userId: "user:default",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...values,
  };
}

const obligations: Array<{ obligation: RecurringObligation; status: "due" | "paid" | "partial" | "missing" }> = [
  {
    obligation: {
      id: "obligation:salary",
      userId: "user:default",
      name: "Salary",
      categoryId: "category:salary",
      expectedAmount: 2_000_000,
      cadence: "monthly",
      dueDay: 28,
      type: "salary",
      status: "active",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    status: "missing",
  },
];

describe("reconciliation and month close", () => {
  it("blocks close when unresolved or duplicate transactions exist", () => {
    const transactions = [
      buildTransaction({
        id: "tx:1",
        accountId: "account:bank",
        type: "income",
        amount: 2_000_000,
        occurredOn: "2026-04-28",
        categoryId: "category:salary",
        reconciliationState: "parsed",
        messageHash: "hash:1",
      }),
      buildTransaction({
        id: "tx:2",
        accountId: "account:bank",
        type: "income",
        amount: 2_000_000,
        occurredOn: "2026-04-28",
        categoryId: "category:salary",
        messageHash: "hash:1",
      }),
    ];

    const evaluation = evaluateMonthClose(transactions, categories, obligations);

    expect(evaluation.unresolvedTransactions).toHaveLength(1);
    expect(evaluation.duplicateGroups).toHaveLength(1);
    expect(evaluation.recurringMissingCount).toBe(1);
    expect(evaluation.isReadyToClose).toBe(false);
  });

  it("builds a ready month close record when checks pass", () => {
    const evaluation = evaluateMonthClose([], categories, []);
    const record = buildMonthCloseRecord(null, "user:default", "2026-04", evaluation);

    expect(record.state).toBe("ready");
    expect(record.unresolvedTransactions).toBe(0);
  });
});
