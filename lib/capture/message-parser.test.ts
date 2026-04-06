import { describe, expect, it } from "vitest";

import type { Category, Transaction } from "@/lib/types";

import { parseCaptureText } from "./message-parser";

const categories: Category[] = [
  { id: "income", userId: "u1", name: "Salary", kind: "income", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "expense", userId: "u1", name: "Groceries", kind: "expense", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "savings", userId: "u1", name: "Savings", kind: "savings", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("parseCaptureText", () => {
  it("parses income and expense messages from pasted text blocks", () => {
    const rows = parseCaptureText({
      input:
        "Received UGX 500000 from Employer Ltd on 27-03-2026\n\nPaid USh 45000 to Grocery store on 06-04-2026",
      source: "sms",
      accountId: "account:bank",
      categories,
      existingTransactions: [],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: "income",
      occurredOn: "2026-03-27",
      currency: "UGX",
      originalAmount: 500000,
      accountId: "account:bank",
    });
    expect(rows[1]).toMatchObject({
      type: "expense",
      occurredOn: "2026-04-06",
      originalAmount: 45000,
    });
  });

  it("flags foreign currency messages without fallback FX", () => {
    const rows = parseCaptureText({
      input: "Paid USD 25 to Netflix on 06-04-2026",
      source: "notification",
      accountId: "account:bank",
      categories,
      existingTransactions: [],
    });

    expect(rows[0]?.currency).toBe("USD");
    expect(rows[0]?.issues).toContain("Missing FX rate");
  });

  it("detects likely duplicates by message hash or equivalent transaction data", () => {
    const existingTransactions: Transaction[] = [
      {
        id: "transaction:1",
        userId: "u1",
        accountId: "account:bank",
        type: "expense",
        amount: 45000,
        currency: "UGX",
        originalAmount: 45000,
        occurredOn: "2026-04-06",
        categoryId: "expense",
        reconciliationState: "reviewed",
        source: "sms",
        payee: "Grocery store",
        rawPayee: "Grocery store",
        note: "Paid USh 45000 to Grocery store on 06-04-2026",
        messageHash: "capture:123",
        reviewedAt: "2026-04-06T00:00:00.000Z",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
    ];

    const rows = parseCaptureText({
      input: "Paid USh 45000 to Grocery store on 06-04-2026",
      source: "sms",
      accountId: "account:bank",
      categories,
      existingTransactions,
    });

    expect(rows[0]?.duplicate).toBe(true);
    expect(rows[0]?.issues).toContain("Likely duplicate");
  });
});
