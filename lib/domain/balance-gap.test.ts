import { describe, expect, it } from "vitest";

import type { CaptureReviewItem, Transaction } from "@/lib/types";

import { detectBalanceGaps, detectBalanceGapsByAccount, pendingReviewGap } from "./balance-gap";

function tx(values: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "occurredOn">): Transaction {
  return {
    userId: "u1", accountId: "acc", currency: "UGX", originalAmount: Math.abs(values.amount),
    categoryId: "c", reconciliationState: "posted", source: "manual",
    createdAt: `${values.occurredOn}T00:00:00.000Z`, updatedAt: `${values.occurredOn}T00:00:00.000Z`,
    ...values,
  };
}

describe("detectBalanceGaps", () => {
  it("finds the hidden fee between two Centenary checkpoints", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "credit", type: "income", amount: 1_790_590, occurredOn: "2026-07-24", statedBalance: 1_791_819 }),
      tx({ id: "debit", type: "expense", amount: 100_000, occurredOn: "2026-07-25", statedBalance: 1_688_944 }),
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ transactionId: "debit", gap: -2_875, statedBalance: 1_688_944 });
  });

  it("reports no gap for a chain that reconciles", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "a", type: "income", amount: 100_000, occurredOn: "2026-07-01", statedBalance: 100_000 }),
      tx({ id: "b", type: "expense", amount: 30_000, occurredOn: "2026-07-02", statedBalance: 70_000 }),
    ]);
    expect(gaps).toHaveLength(0);
  });

  it("does not flag a single checkpoint", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "only", type: "expense", amount: 5_000, occurredOn: "2026-07-01", statedBalance: 5_000 }),
    ]);
    expect(gaps).toHaveLength(0);
  });
});

describe("pendingReviewGap", () => {
  const item = {
    id: "review-1", userId: "u1", accountId: "acc", occurredOn: "2026-07-25",
    originalAmount: 100_000, currency: "UGX", normalizedAmount: 100_000, type: "expense",
    categoryId: "c", payee: "x", note: "", messageHash: "h", confidenceScore: 0.7,
    status: "new", issues: [], fieldWarnings: [], statedBalance: 1_688_944,
    envelopeId: "e", source: "sms",
    originalSnapshot: {} as CaptureReviewItem["originalSnapshot"],
    createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z",
  } as CaptureReviewItem;

  it("detects the shortfall against a prior ledger checkpoint", () => {
    const ledger = [
      tx({ id: "credit", type: "income", amount: 1_790_590, occurredOn: "2026-07-24", statedBalance: 1_791_819 }),
    ];
    const gap = pendingReviewGap(item, ledger);
    expect(gap?.gap).toBe(-2_875);
  });

  it("returns null when the item has no stated balance", () => {
    expect(pendingReviewGap({ ...item, statedBalance: undefined }, [])).toBeNull();
  });
});

describe("detectBalanceGapsByAccount", () => {
  const row = (
    id: string,
    accountId: string,
    amount: number,
    statedBalance?: number,
  ): Transaction => ({
    id,
    userId: "u1",
    accountId,
    type: "expense",
    amount,
    currency: "UGX",
    originalAmount: amount,
    occurredOn: `2026-08-${id.padStart(2, "0")}`,
    categoryId: "cat:food",
    reconciliationState: "posted",
    source: "sms",
    statedBalance,
    createdAt: `2026-08-${id.padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: `2026-08-${id.padStart(2, "0")}T00:00:00.000Z`,
  });

  it("measures each account against its own statements", () => {
    const gaps = detectBalanceGapsByAccount([
      row("01", "acc:momo", 1_000, 50_000),
      row("02", "acc:bank", 5_000, 900_000),
      row("03", "acc:momo", 1_000, 44_000),
    ]);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ accountId: "acc:momo", gap: -5_000 });
  });

  it("does not charge one account's spending against another's statement", () => {
    // Momo is internally consistent: 50,000 less 1,000 spent is 49,000. The
    // bank row between them must not be charged against Momo's statement.
    const mixed = [
      row("01", "acc:momo", 1_000, 50_000),
      row("02", "acc:bank", 40_000),
      row("03", "acc:momo", 1_000, 49_000),
    ];

    expect(detectBalanceGapsByAccount(mixed)).toEqual([]);
    expect(detectBalanceGaps(mixed).length).toBeGreaterThan(0);
  });
});
