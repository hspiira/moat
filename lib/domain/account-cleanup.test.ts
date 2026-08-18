import { describe, expect, it } from "vitest";

import {
  canDeleteAccount,
  findDuplicatePoolAccounts,
  planAccountMerge,
} from "@/lib/domain/account-cleanup";
import { buildBorrowingPoolAccount } from "@/lib/domain/borrowing";
import { buildCounterparty } from "@/lib/domain/counterparties";
import { buildLendingPoolAccount } from "@/lib/domain/lending";
import type { Account, Counterparty, Transaction } from "@/lib/types";

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
  function merge(
    source: Account,
    target: Account,
    rows: Transaction[] = [],
    counterparties: Counterparty[] = [],
  ) {
    let seq = 0;
    return planAccountMerge({
      source,
      target,
      transactions: rows,
      counterparties,
      timestamp: TIMESTAMP,
      nextCounterpartyId: () => `counterparty:${(seq += 1)}`,
    });
  }

  it("turns the account into a counterparty and re-points every record at it", () => {
    const rows = [
      transaction(),
      transaction({ id: "tx:writeoff", type: "expense", amount: 20_000 }),
      transaction({ id: "tx:elsewhere", accountId: "account:wallet" }),
    ];

    const plan = merge(account({ name: "Loan to Sarah" }), pool, rows);

    expect(plan.blocked).toBeUndefined();
    if (plan.blocked !== undefined) return;

    expect(plan.counterparty.name).toBe("Loan to Sarah");
    expect(plan.counterparty.kind).toBe("borrower");
    expect(plan.transactions).toHaveLength(2);
    expect(plan.transactions.every((row) => row.accountId === pool.id)).toBe(true);
    expect(
      plan.transactions.every((row) => row.counterpartyId === plan.counterparty.id),
    ).toBe(true);
    expect(plan.transactions[0].transferGroupId).toBe("transfer:abc");
    expect(plan.transactions[0].amount).toBe(120_000);
  });

  it("reuses a counterparty that already exists under that name", () => {
    const existing = buildCounterparty({
      id: "counterparty:sarah",
      userId: "user:default",
      name: "loan to sarah",
      kind: "borrower",
      timestamp: TIMESTAMP,
    });

    const plan = merge(account({ name: "Loan to Sarah" }), pool, [], [existing]);

    expect(plan.blocked).toBeUndefined();
    if (plan.blocked !== undefined) return;
    expect(plan.counterparty.id).toBe("counterparty:sarah");
  });

  it("carries an opening balance onto the person and the pool together", () => {
    const plan = merge(account({ openingBalance: 300_000, balance: 300_000 }), pool);

    expect(plan.blocked).toBeUndefined();
    if (plan.blocked !== undefined) return;

    expect(plan.counterparty.openingBalance).toBe(300_000);
    expect(plan.target.openingBalance).toBe(pool.openingBalance + 300_000);
    expect(plan.target.balance).toBe(pool.balance + 300_000);
  });

  it("refuses to merge across opposite directions of money", () => {
    const borrowingPool = buildBorrowingPoolAccount("user:default", TIMESTAMP);

    expect(merge(account(), borrowingPool).blocked).toContain("opposite directions");
  });

  it("refuses to merge a seeded pool away or into itself", () => {
    expect(merge(pool, account()).blocked).toContain("cannot be merged away");
    expect(merge(pool, pool).blocked).toContain("into itself");
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
