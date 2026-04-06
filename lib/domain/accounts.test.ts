import { describe, expect, it } from "vitest";

import {
  getAccountBalanceBreakdown,
  normalizeOpeningBalance,
  reconcileAccountBalances,
} from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";

const account: Account = {
  id: "account:wallet",
  userId: "user:default",
  name: "Wallet",
  type: "cash",
  openingBalance: 100_000,
  balance: 100_000,
  isArchived: false,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

function buildTransaction(
  values: Partial<Transaction> & Pick<Transaction, "id" | "accountId" | "type" | "amount" | "occurredOn" | "categoryId">,
): Transaction {
  return {
    userId: "user:default",
    reconciliationState: "posted",
    source: "manual",
    currency: "UGX",
    originalAmount: Math.abs(values.amount),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...values,
  };
}

describe("reconcileAccountBalances", () => {
  it("applies income and spending movements to the opening balance", () => {
    const transactions: Transaction[] = [
      buildTransaction({
        id: "tx:salary",
        accountId: account.id,
        type: "income",
        amount: 50_000,
        occurredOn: "2026-04-05",
        categoryId: "category:salary",
      }),
      buildTransaction({
        id: "tx:food",
        accountId: account.id,
        type: "expense",
        amount: 10_000,
        occurredOn: "2026-04-06",
        categoryId: "category:food",
      }),
    ];

    const [reconciled] = reconcileAccountBalances([account], transactions);

    expect(reconciled.balance).toBe(140_000);
  });

  it("treats paired transfer records as directional balance movements", () => {
    const transactions: Transaction[] = [
      buildTransaction({
        id: "tx:transfer-out",
        accountId: account.id,
        type: "transfer",
        amount: -25_000,
        occurredOn: "2026-04-07",
        categoryId: "category:transfers",
        transferGroupId: "transfer:1",
      }),
    ];

    const [reconciled] = reconcileAccountBalances([account], transactions);

    expect(reconciled.balance).toBe(75_000);
  });

  it("normalizes debt opening balances as liabilities", () => {
    expect(normalizeOpeningBalance("debt", 500_000)).toBe(-500_000);
    expect(normalizeOpeningBalance("debt", -500_000)).toBe(-500_000);
    expect(normalizeOpeningBalance("cash", 500_000)).toBe(500_000);
  });

  it("returns a balance breakdown that explains the current balance", () => {
    const transactions: Transaction[] = [
      buildTransaction({
        id: "tx:salary",
        accountId: account.id,
        type: "income",
        amount: 50_000,
        occurredOn: "2026-04-05",
        categoryId: "category:salary",
      }),
      buildTransaction({
        id: "tx:food",
        accountId: account.id,
        type: "expense",
        amount: 10_000,
        occurredOn: "2026-04-06",
        categoryId: "category:food",
      }),
      buildTransaction({
        id: "tx:transfer-out",
        accountId: account.id,
        type: "transfer",
        amount: -5_000,
        occurredOn: "2026-04-07",
        categoryId: "category:transfers",
        transferGroupId: "transfer:1",
      }),
    ];

    expect(getAccountBalanceBreakdown(account, transactions)).toEqual({
      openingBalance: 100_000,
      inflow: 50_000,
      outflow: 10_000,
      savingsAllocations: 0,
      transfers: -5_000,
      movement: 35_000,
      currentBalance: 135_000,
    });
  });

  it("builds running-balance ledger rows in posting order", async () => {
    const { getLedgerRows } = await import("@/lib/domain/accounts");

    const rows = getLedgerRows(account, [
      buildTransaction({
        id: "tx:salary",
        accountId: account.id,
        type: "income",
        amount: 50_000,
        occurredOn: "2026-04-05",
        categoryId: "category:salary",
      }),
      buildTransaction({
        id: "tx:food",
        accountId: account.id,
        type: "expense",
        amount: 10_000,
        occurredOn: "2026-04-06",
        categoryId: "category:food",
      }),
    ]);

    expect(rows.map((row) => row.runningBalance)).toEqual([150_000, 140_000]);
    expect(rows[0]).toMatchObject({ credit: 50_000, debit: 0 });
    expect(rows[1]).toMatchObject({ credit: 0, debit: 10_000 });
  });
});
