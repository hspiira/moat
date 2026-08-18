import { describe, expect, it } from "vitest";

import {
  isEditableTransaction,
  isEditableTransfer,
  planTransactionCascade,
  transferLegs,
} from "@/lib/domain/transaction-cascade";
import type { Transaction } from "@/lib/types";

const BASE: Transaction = {
  id: "t:base",
  userId: "u1",
  accountId: "account:momo",
  type: "expense",
  amount: 1000,
  currency: "UGX",
  originalAmount: 1000,
  occurredOn: "2026-08-17",
  categoryId: "category:food",
  reconciliationState: "posted",
  source: "manual",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

const make = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
  ...BASE,
  ...overrides,
});

describe("planTransactionCascade", () => {
  it("takes only the row itself for a plain expense", () => {
    const expense = make({ id: "t:1" });
    expect([...planTransactionCascade(expense, [expense])]).toEqual(["t:1"]);
  });

  it("takes both legs of a transfer from either side", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -5000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 5000, transferGroupId: "g1" });
    const all = [source, destination];

    expect(planTransactionCascade(source, all)).toEqual(new Set(["t:src", "t:dst"]));
    expect(planTransactionCascade(destination, all)).toEqual(new Set(["t:src", "t:dst"]));
  });

  it("takes the interest leg of a loan repayment", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -50000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 50000, transferGroupId: "g1" });
    const interest = make({ id: "t:int", type: "expense", amount: 7000, transferGroupId: "g1" });
    const all = [source, destination, interest];

    expect(planTransactionCascade(source, all)).toEqual(new Set(["t:src", "t:dst", "t:int"]));
    expect(planTransactionCascade(interest, all)).toEqual(new Set(["t:src", "t:dst", "t:int"]));
  });

  it("takes a fee charged against the row being deleted", () => {
    const payment = make({ id: "t:pay" });
    const fee = make({ id: "t:fee", amount: 500, feeParentId: "t:pay" });

    expect(planTransactionCascade(payment, [payment, fee])).toEqual(new Set(["t:pay", "t:fee"]));
  });

  it("takes a fee charged against a transfer leg pulled in by the group", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -5000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 5000, transferGroupId: "g1" });
    const fee = make({ id: "t:fee", amount: 500, feeParentId: "t:src" });

    expect(planTransactionCascade(destination, [source, destination, fee])).toEqual(
      new Set(["t:src", "t:dst", "t:fee"]),
    );
  });

  it("leaves an unrelated transaction alone", () => {
    const target = make({ id: "t:1", transferGroupId: "g1", type: "transfer" });
    const other = make({ id: "t:2", transferGroupId: "g2", type: "transfer" });
    const unrelatedFee = make({ id: "t:3", feeParentId: "t:2" });

    expect(planTransactionCascade(target, [target, other, unrelatedFee])).toEqual(new Set(["t:1"]));
  });

  it("terminates on a fee that points at itself", () => {
    const looping = make({ id: "t:loop", feeParentId: "t:loop" });
    expect(planTransactionCascade(looping, [looping])).toEqual(new Set(["t:loop"]));
  });
});

describe("isEditableTransfer", () => {
  const source = make({ id: "t:src", type: "transfer", amount: -50000, transferGroupId: "g1" });
  const destination = make({ id: "t:dst", type: "transfer", amount: 50000, transferGroupId: "g1" });

  it("allows a plain two-leg transfer", () => {
    expect(isEditableTransfer(source, [source, destination])).toBe(true);
  });

  it("refuses a loan repayment, whose interest split cannot be rebuilt", () => {
    const interest = make({ id: "t:int", type: "expense", amount: 7000, transferGroupId: "g1" });
    const all = [source, destination, interest];
    expect(isEditableTransfer(source, all)).toBe(false);
    expect(isEditableTransfer(destination, all)).toBe(false);
  });

  it("refuses anything that is not a transfer", () => {
    const expense = make({ id: "t:1" });
    expect(isEditableTransfer(expense, [expense])).toBe(false);
  });

  it("refuses a half-written pair rather than rebuilding from one leg", () => {
    expect(isEditableTransfer(source, [source])).toBe(false);
  });
});

describe("transferLegs", () => {
  it("sorts the pair by sign rather than by storage order", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -50000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 50000, transferGroupId: "g1" });

    expect(transferLegs(destination, [destination, source])).toEqual({ source, destination });
  });

  it("returns null when a leg is missing", () => {
    const lonely = make({ id: "t:src", type: "transfer", amount: -50000, transferGroupId: "g1" });
    expect(transferLegs(lonely, [lonely])).toBeNull();
  });
});

describe("isEditableTransaction", () => {
  it("allows a plain expense", () => {
    const expense = make({ id: "t:1" });
    expect(isEditableTransaction(expense, [expense])).toBe(true);
  });

  it("refuses a fee, which is edited through its payment", () => {
    const payment = make({ id: "t:pay" });
    const fee = make({ id: "t:fee", amount: 500, feeParentId: "t:pay" });
    expect(isEditableTransaction(fee, [payment, fee])).toBe(false);
  });

  it("allows either leg of a plain transfer", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -5000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 5000, transferGroupId: "g1" });
    expect(isEditableTransaction(source, [source, destination])).toBe(true);
    expect(isEditableTransaction(destination, [source, destination])).toBe(true);
  });

  it("refuses the interest leg of a loan repayment", () => {
    const source = make({ id: "t:src", type: "transfer", amount: -50000, transferGroupId: "g1" });
    const destination = make({ id: "t:dst", type: "transfer", amount: 50000, transferGroupId: "g1" });
    const interest = make({ id: "t:int", type: "expense", amount: 7000, transferGroupId: "g1" });

    expect(isEditableTransaction(interest, [source, destination, interest])).toBe(false);
  });
});
