import { describe, expect, it } from "vitest";

import {
  dearestAccountToMoveFrom,
  getFeeLoad,
  getFeeLoadByAccount,
  isFeeTransaction,
} from "@/lib/domain/fees";
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

describe("fees per account", () => {
  const row = (id: string, accountId: string, amount: number, isFee = false) =>
    transaction({
      id,
      accountId,
      amount,
      ...(isFee ? { feeParentId: `${id}-parent` } : {}),
    });

  // Momo: 300,000 moved for 3,000 in charges — 10 per thousand.
  // Bank: 1,000,000 moved for 5,000 — 5 per thousand, dearer in total, cheaper to use.
  const rows = [
    row("momo-out", "acc:momo", 300_000),
    row("momo-fee", "acc:momo", 3_000, true),
    row("bank-out", "acc:bank", 1_000_000),
    row("bank-fee", "acc:bank", 5_000, true),
    row("cash-out", "acc:cash", 50_000),
  ];

  it("leaves out accounts that never charged you", () => {
    expect(getFeeLoadByAccount(rows).map((load) => load.accountId)).toEqual([
      "acc:bank",
      "acc:momo",
    ]);
  });

  it("orders by what each account cost you", () => {
    expect(getFeeLoadByAccount(rows)[0]).toMatchObject({ accountId: "acc:bank", fees: 5_000 });
  });

  it("gives a rate that does not just follow how much you moved", () => {
    const byAccount = getFeeLoadByAccount(rows);

    expect(byAccount.find((load) => load.accountId === "acc:bank")?.costPerThousandMoved).toBe(5);
    expect(byAccount.find((load) => load.accountId === "acc:momo")?.costPerThousandMoved).toBe(10);
  });

  it("names the dearest account by rate, not by total", () => {
    expect(dearestAccountToMoveFrom(rows, 0)?.accountId).toBe("acc:momo");
  });

  it("ignores an account you have barely used, where the rate means little", () => {
    expect(dearestAccountToMoveFrom(rows, 500_000)?.accountId).toBe("acc:bank");
  });

  it("names nothing when no account has been used enough", () => {
    expect(dearestAccountToMoveFrom(rows, 5_000_000)).toBeNull();
  });
});
