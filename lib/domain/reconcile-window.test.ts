import { describe, expect, it } from "vitest";

import { getReconcileWindow } from "@/lib/domain/reconcile-window";
import type { Transaction } from "@/lib/types";

function entry(values: {
  id: string;
  day: string;
  amount: number;
  type?: Transaction["type"];
  statedBalance?: number;
}): Transaction {
  return {
    id: values.id,
    userId: "user:default",
    accountId: "account:momo",
    type: values.type ?? "expense",
    amount: values.amount,
    currency: "UGX",
    originalAmount: Math.abs(values.amount),
    occurredOn: values.day,
    categoryId: "category:food",
    reconciliationState: "posted",
    source: "sms",
    statedBalance: values.statedBalance,
    createdAt: `${values.day}T08:00:00.000Z`,
    updatedAt: `${values.day}T08:00:00.000Z`,
  };
}

describe("getReconcileWindow", () => {
  it("finds nothing when the entries account for the change", () => {
    const window = getReconcileWindow([
      entry({ id: "a", day: "2026-04-01", amount: 1_000, statedBalance: 50_000 }),
      entry({ id: "b", day: "2026-04-02", amount: 3_000 }),
      entry({ id: "c", day: "2026-04-03", amount: 2_000, statedBalance: 45_000 }),
    ]);

    expect(window).toBeNull();
  });

  it("narrows to the entries between the last two stated balances", () => {
    const window = getReconcileWindow([
      entry({ id: "old", day: "2026-03-01", amount: 500, statedBalance: 90_000 }),
      entry({ id: "settled", day: "2026-03-02", amount: 5_000, statedBalance: 85_000 }),
      entry({ id: "inside", day: "2026-04-02", amount: 3_000 }),
      entry({ id: "checkpoint", day: "2026-04-03", amount: 2_000, statedBalance: 75_000 }),
    ]);

    expect(window?.gap).toBe(-5_000);
    expect(window?.entries.map((row) => row.id)).toEqual(["inside", "checkpoint"]);
    expect(window?.openedOn).toBe("2026-03-02");
    expect(window?.statedOn).toBe("2026-04-03");
  });

  it("reports the newest disagreement, not the first", () => {
    const window = getReconcileWindow([
      entry({ id: "a", day: "2026-02-01", amount: 0, statedBalance: 100_000 }),
      entry({ id: "b", day: "2026-02-02", amount: 1_000, statedBalance: 90_000 }),
      entry({ id: "c", day: "2026-03-02", amount: 1_000, statedBalance: 80_000 }),
    ]);

    expect(window?.statedOn).toBe("2026-03-02");
    expect(window?.gap).toBe(-9_000);
  });

  it("says what the entries add up to, so the two figures can be compared", () => {
    const window = getReconcileWindow([
      entry({ id: "a", day: "2026-04-01", amount: 0, statedBalance: 60_000 }),
      entry({ id: "b", day: "2026-04-05", amount: 10_000, statedBalance: 40_000 }),
    ]);

    expect(window?.statedBalance).toBe(40_000);
    expect(window?.expectedBalance).toBe(50_000);
  });
});
