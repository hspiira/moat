import { describe, expect, it } from "vitest";

import type { Transaction } from "@/lib/types";
import type { MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";

import { getMonthCloseBlockers } from "./month-close-blockers";

function transaction(
  values: Partial<Transaction> & Pick<Transaction, "id">,
): Transaction {
  return {
    userId: "u1",
    accountId: "acc-1",
    type: "expense",
    amount: 86_400,
    currency: "UGX",
    originalAmount: 86_400,
    occurredOn: "2026-07-24",
    categoryId: "cat-groceries",
    reconciliationState: "draft",
    source: "sms",
    createdAt: "2026-07-24T08:00:00.000Z",
    updatedAt: "2026-07-24T08:00:00.000Z",
    ...values,
  };
}

function evaluation(overrides: Partial<MonthCloseEvaluation> = {}): MonthCloseEvaluation {
  return {
    unresolvedTransactions: [],
    duplicateGroups: [],
    missingCategoryTransactions: [],
    recurringDueCount: 0,
    recurringMissingCount: 0,
    isReadyToClose: true,
    ...overrides,
  };
}

function obligation(name: string, state: RecurringEvaluation["state"]): RecurringEvaluation {
  return {
    obligation: { id: `ob:${name}`, name, expectedAmount: 50_000 } as RecurringEvaluation["obligation"],
    matchedTransactions: [],
    matchedAmount: 0,
    expectedAmount: 50_000,
    state,
  };
}

describe("getMonthCloseBlockers", () => {
  it("reports nothing to clear for a clean month", () => {
    const result = getMonthCloseBlockers({ evaluation: evaluation(), recurringEvaluations: [] });
    expect(result.groups).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("groups unresolved records with the transactions themselves, not just a count", () => {
    const unposted = transaction({ id: "t1", payee: "Shoprite" });
    const result = getMonthCloseBlockers({
      evaluation: evaluation({ unresolvedTransactions: [unposted], isReadyToClose: false }),
      recurringEvaluations: [],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ kind: "unresolved", label: "Not yet posted", count: 1 });
    expect(result.groups[0].entries[0]).toMatchObject({
      id: "t1",
      transaction: unposted,
    });
  });

  it("carries every duplicate group's records so they can be compared", () => {
    const a = transaction({ id: "t1", payee: "Airtime" });
    const b = transaction({ id: "t2", payee: "Airtime" });
    const result = getMonthCloseBlockers({
      evaluation: evaluation({
        duplicateGroups: [{ key: "hash:1", transactions: [a, b] }],
        isReadyToClose: false,
      }),
      recurringEvaluations: [],
    });

    const group = result.groups.find((entry) => entry.kind === "duplicate");
    expect(group?.count).toBe(1);
    expect(group?.entries[0].transactions).toEqual([a, b]);
  });

  it("lists only unpaid obligations, naming each one", () => {
    const result = getMonthCloseBlockers({
      evaluation: evaluation({ isReadyToClose: false }),
      recurringEvaluations: [
        obligation("Rent", "paid"),
        obligation("School fees", "missing"),
        obligation("Water", "partial"),
      ],
    });

    const group = result.groups.find((entry) => entry.kind === "obligation");
    expect(group?.count).toBe(2);
    expect(group?.entries.map((entry) => entry.name)).toEqual(["School fees", "Water"]);
  });

  it("totals every blocker across groups", () => {
    const result = getMonthCloseBlockers({
      evaluation: evaluation({
        unresolvedTransactions: [transaction({ id: "t1" }), transaction({ id: "t2" })],
        duplicateGroups: [{ key: "k", transactions: [transaction({ id: "t3" })] }],
        isReadyToClose: false,
      }),
      recurringEvaluations: [obligation("Rent", "missing")],
    });

    expect(result.total).toBe(4);
    expect(result.groups.map((group) => group.kind)).toEqual([
      "unresolved",
      "duplicate",
      "obligation",
    ]);
  });

  it("omits groups that have nothing in them", () => {
    const result = getMonthCloseBlockers({
      evaluation: evaluation({
        duplicateGroups: [{ key: "k", transactions: [transaction({ id: "t1" })] }],
        isReadyToClose: false,
      }),
      recurringEvaluations: [obligation("Rent", "paid")],
    });

    expect(result.groups.map((group) => group.kind)).toEqual(["duplicate"]);
  });
});
