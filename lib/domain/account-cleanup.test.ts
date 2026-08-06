import { describe, expect, it } from "vitest";

import {
  canDeleteAccount,
  findDuplicatePoolAccounts,
  planAccountMerge,
} from "@/lib/domain/account-cleanup";
import { buildBorrowingPoolAccount } from "@/lib/domain/borrowing";
import { buildLendingPoolAccount } from "@/lib/domain/lending";
import type { Account, Transaction } from "@/lib/types";

const TIMESTAMP = "2026-08-06T00:00:00.000Z";
const pool = buildLendingPoolAccount("user:default", "2026-01-01T00:00:00.000Z");

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "account:duplicate",
    userId: "user:default",
    name: "Money lent out",
    type: "receivable",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "transfer:abc:destination",
    userId: "user:default",
    accountId: "account:duplicate",
    type: "transfer",
    amount: 120_000,
    currency: "UGX",
    originalAmount: 120_000,
    occurredOn: "2026-05-01",
    categoryId: "category:lending",
    transferGroupId: "transfer:abc",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("canDeleteAccount", () => {
  it("allows deleting an account with nothing to orphan", () => {
    expect(canDeleteAccount(account(), [])).toEqual({ allowed: true });
  });

  it("refuses to delete an account that still has records", () => {
    const verdict = canDeleteAccount(account(), [transaction()]);

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toContain("1 transaction");
  });

  it("counts only the account's own records", () => {
    const verdict = canDeleteAccount(account(), [
      transaction({ id: "tx:other", accountId: "account:wallet" }),
    ]);

    expect(verdict).toEqual({ allowed: true });
  });

  it("never deletes a seeded pool, however empty it is", () => {
    const verdict = canDeleteAccount(pool, []);

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toContain("Archive it instead");
  });
});

describe("planAccountMerge", () => {
  it("re-points every record and stamps the account name as the payee", () => {
    const source = account({ name: "Loan to Sarah" });
    const rows = [
      transaction(),
      transaction({ id: "tx:writeoff", type: "expense", amount: 20_000 }),
      transaction({ id: "tx:elsewhere", accountId: "account:wallet" }),
    ];

    const plan = planAccountMerge(source, pool, rows, TIMESTAMP);

    expect(plan.blocked).toBeUndefined();
    expect(plan.transactions).toHaveLength(2);
    expect(plan.transactions.every((row) => row.accountId === pool.id)).toBe(true);
    expect(plan.transactions.every((row) => row.payee === "Loan to Sarah")).toBe(true);
    expect(plan.transactions.every((row) => row.updatedAt === TIMESTAMP)).toBe(true);
    // The transfer pair must stay balanced, so the moved leg keeps its group
    // and its amount untouched.
    expect(plan.transactions[0].transferGroupId).toBe("transfer:abc");
    expect(plan.transactions[0].amount).toBe(120_000);
  });

  it("leaves the originally captured text alone", () => {
    const plan = planAccountMerge(
      account({ name: "Loan to Sarah" }),
      pool,
      [transaction({ payee: "SARAH K", rawPayee: "MTN: SARAH K" })],
      TIMESTAMP,
    );

    expect(plan.transactions[0].payee).toBe("Loan to Sarah");
    expect(plan.transactions[0].rawPayee).toBe("MTN: SARAH K");
  });

  it("refuses to merge away an opening balance it cannot attribute", () => {
    const plan = planAccountMerge(
      account({ openingBalance: 300_000, balance: 300_000 }),
      pool,
      [],
      TIMESTAMP,
    );

    expect(plan.blocked).toContain("opening balance");
    expect(plan.transactions).toEqual([]);
  });

  it("refuses to merge across opposite directions of money", () => {
    const borrowingPool = buildBorrowingPoolAccount("user:default", TIMESTAMP);

    const plan = planAccountMerge(account(), borrowingPool, [], TIMESTAMP);

    expect(plan.blocked).toContain("opposite directions");
  });

  it("refuses to merge a seeded pool away or into itself", () => {
    expect(planAccountMerge(pool, account(), [], TIMESTAMP).blocked).toContain(
      "cannot be merged away",
    );
    expect(planAccountMerge(pool, pool, [], TIMESTAMP).blocked).toContain("into itself");
  });
});

describe("findDuplicatePoolAccounts", () => {
  it("finds accounts that read as a seeded pool but are not one", () => {
    const duplicates = findDuplicatePoolAccounts([
      pool,
      account(),
      account({ id: "account:dedicated", name: "Loan to Sarah" }),
      account({ id: "account:archived", isArchived: true }),
    ]);

    expect(duplicates.map((entry) => entry.id)).toEqual(["account:duplicate"]);
  });
});
