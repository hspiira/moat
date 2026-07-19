import { describe, expect, it } from "vitest";

import type { Transaction } from "@/lib/types";

import { buildMonthCloseCsv } from "./month-close-export";

function buildTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: `txn:${Math.random().toString(36).slice(2)}`,
    userId: "user:default",
    accountId: "account:main",
    type: "expense",
    amount: 10_000,
    currency: "UGX",
    originalAmount: 10_000,
    occurredOn: "2026-04-05",
    categoryId: "category:food",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildMonthCloseCsv", () => {
  it("includes only transactions from the close period", () => {
    const csv = buildMonthCloseCsv(
      [
        buildTransaction({ occurredOn: "2026-04-05", payee: "InPeriod" }),
        buildTransaction({ occurredOn: "2026-03-28", payee: "OutOfPeriod" }),
      ],
      [],
      "2026-04",
    );

    expect(csv).toContain("InPeriod");
    expect(csv).not.toContain("OutOfPeriod");
  });

  it("emits summary metrics followed by a transaction table", () => {
    const csv = buildMonthCloseCsv(
      [
        buildTransaction({ type: "income", amount: 100_000 }),
        buildTransaction({ type: "expense", amount: 30_000 }),
      ],
      [],
      "2026-04",
    );

    const lines = csv.split("\n");
    expect(lines[0]).toBe("Metric,Value");
    expect(csv).toContain("Inflow,100000");
    expect(csv).toContain("Outflow,30000");
    expect(csv).toContain("Saved,70000");
    expect(csv).toContain("Date,Type,Account,Category,Payee,Amount,State,Note");
  });

  it("strips commas from notes so rows stay parseable", () => {
    const csv = buildMonthCloseCsv(
      [buildTransaction({ note: "rent, april, late" })],
      [],
      "2026-04",
    );

    const transactionRow = csv.split("\n").at(-1);
    expect(transactionRow).toContain("rent  april  late");
    expect(transactionRow?.split(",")).toHaveLength(8);
  });
});
