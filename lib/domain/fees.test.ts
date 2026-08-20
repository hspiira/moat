import { describe, expect, it } from "vitest";

import { getFeeLoad, isFeeTransaction } from "@/lib/domain/fees";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";

function transaction(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "acc:momo",
    type: "expense",
    amount: 10_000,
    currency: "UGX",
    originalAmount: 10_000,
    occurredOn: "2026-08-01",
    categoryId: "cat:food",
    reconciliationState: "posted",
    source: "sms",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  };
}

describe("isFeeTransaction", () => {
  it("counts a row charged against a payment", () => {
    expect(isFeeTransaction(transaction({ id: "t1", feeParentId: "t0" }))).toBe(true);
  });

  it("counts a row filed under fees even with no parent", () => {
    expect(
      isFeeTransaction(transaction({ id: "t1", categoryId: feesCategoryId(USER) })),
    ).toBe(true);
  });

  it("leaves ordinary spending alone", () => {
    expect(isFeeTransaction(transaction({ id: "t1" }))).toBe(false);
  });
});

describe("getFeeLoad", () => {
  it("adds up what moving money cost", () => {
    const load = getFeeLoad([
      transaction({ id: "t1", amount: 200_000 }),
      transaction({ id: "t1:fee", amount: 1_725, feeParentId: "t1" }),
      transaction({ id: "t2", amount: 50_000 }),
      transaction({ id: "t2:fee", amount: 500, feeParentId: "t2" }),
    ]);

    expect(load.fees).toBe(2_225);
    expect(load.count).toBe(2);
    expect(load.movedOut).toBe(250_000);
    expect(load.share).toBeCloseTo(2_225 / 250_000);
  });

  it("counts the leaving leg of a transfer as money moved", () => {
    const load = getFeeLoad([
      transaction({ id: "out", type: "transfer", amount: -200_000, transferGroupId: "g" }),
      transaction({ id: "in", type: "transfer", amount: 200_000, transferGroupId: "g" }),
      transaction({ id: "fee", amount: 1_725, feeParentId: "out" }),
    ]);

    expect(load.movedOut).toBe(200_000);
    expect(load.fees).toBe(1_725);
  });

  it("does not count income as money moved out", () => {
    const load = getFeeLoad([
      transaction({ id: "pay", type: "income", amount: 900_000 }),
      transaction({ id: "fee", amount: 500, feeParentId: "pay" }),
    ]);

    expect(load.movedOut).toBe(0);
    expect(load.share).toBe(0);
  });

  it("never divides by zero when nothing moved", () => {
    expect(getFeeLoad([])).toEqual({ fees: 0, count: 0, movedOut: 0, share: 0 });
  });

  it("keeps a fee out of the money-moved figure it is measured against", () => {
    const load = getFeeLoad([
      transaction({ id: "t1", amount: 100_000 }),
      transaction({ id: "t1:fee", amount: 1_000, feeParentId: "t1" }),
    ]);

    expect(load.movedOut).toBe(100_000);
  });
});
