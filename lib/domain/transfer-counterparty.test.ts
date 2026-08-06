import { describe, expect, it } from "vitest";

import { buildBorrowingPoolAccount } from "@/lib/domain/borrowing";
import { buildLendingPoolAccount } from "@/lib/domain/lending";
import { describeTransferCounterparty } from "@/lib/domain/transfer-counterparty";
import type { Account } from "@/lib/types";

const TIMESTAMP = "2026-01-01T00:00:00.000Z";
const lendingPool = buildLendingPoolAccount("user:default", TIMESTAMP);
const borrowingPool = buildBorrowingPoolAccount("user:default", TIMESTAMP);

function account(id: string, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    userId: "user:default",
    name,
    type: "cash",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

const wallet = account("account:wallet", "MTN wallet", { type: "mobile_money" });
const dedicatedReceivable = account("account:sarah", "Loan to Sarah", { type: "receivable" });
const dedicatedLender = account("account:grace", "Auntie Grace", { type: "debt" });
const saccoLoan = account("account:sacco", "SACCO loan", {
  type: "debt",
  debtInterestRate: 12,
  debtPrincipal: 900_000,
});

const accounts = [
  wallet,
  lendingPool,
  borrowingPool,
  dedicatedReceivable,
  dedicatedLender,
  saccoLoan,
];

function describe_(sourceId: string, destinationId: string) {
  return describeTransferCounterparty(accounts, sourceId, destinationId);
}

describe("describeTransferCounterparty", () => {
  it("asks who borrowed it when lending into the pool", () => {
    const result = describe_(wallet.id, lendingPool.id);

    expect(result?.direction).toBe("lend");
    expect(result?.label).toBe("Who borrowed it");
    expect(result?.requiresPayee).toBe(true);
    expect(result?.showExpectedDate).toBe(true);
  });

  it("asks who is repaying when money comes back out of the pool", () => {
    const result = describe_(lendingPool.id, wallet.id);

    expect(result?.direction).toBe("collect");
    expect(result?.label).toBe("Who is repaying you");
    expect(result?.requiresPayee).toBe(true);
    expect(result?.showExpectedDate).toBe(false);
  });

  it("asks who lent it when borrowing from the pool", () => {
    const result = describe_(borrowingPool.id, wallet.id);

    expect(result?.direction).toBe("borrow");
    expect(result?.label).toBe("Who lent it to you");
    expect(result?.requiresPayee).toBe(true);
    expect(result?.showExpectedDate).toBe(true);
  });

  it("asks who is being repaid when paying the pool back", () => {
    const result = describe_(wallet.id, borrowingPool.id);

    expect(result?.direction).toBe("repay");
    expect(result?.requiresPayee).toBe(true);
    expect(result?.showExpectedDate).toBe(false);
  });

  it("still offers a due date on a dedicated account but does not ask for a name", () => {
    const lend = describe_(wallet.id, dedicatedReceivable.id);
    const borrow = describe_(dedicatedLender.id, wallet.id);

    expect(lend?.requiresPayee).toBe(false);
    expect(lend?.showExpectedDate).toBe(true);
    expect(borrow?.requiresPayee).toBe(false);
    expect(borrow?.showExpectedDate).toBe(true);
  });

  it("says nothing for transfers that are not loans", () => {
    expect(describe_(wallet.id, account("account:bank", "Bank").id)).toBeNull();
    expect(describe_(wallet.id, "account:missing")).toBeNull();
    expect(describe_(lendingPool.id, borrowingPool.id)).toBeNull();
  });

  it("leaves a formal loan to the payoff planner", () => {
    expect(describe_(wallet.id, saccoLoan.id)).toBeNull();
    expect(describe_(saccoLoan.id, wallet.id)).toBeNull();
  });
});
