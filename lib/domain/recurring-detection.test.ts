import { describe, expect, it } from "vitest";

import { detectRecurringCandidates } from "@/lib/domain/recurring-detection";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";

function transaction(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "acc:momo",
    type: "expense",
    amount: 1_500_000,
    currency: "UGX",
    originalAmount: 1_500_000,
    occurredOn: "2026-06-01",
    categoryId: "cat:rent",
    reconciliationState: "posted",
    source: "sms",
    payee: "Landlord",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  };
}

const rent = ["2026-06-01", "2026-07-02", "2026-08-01"].map((occurredOn, index) =>
  transaction({ id: `rent:${index}`, occurredOn }),
);

describe("detectRecurringCandidates", () => {
  it("spots a bill paid once a month for the same amount", () => {
    const [found] = detectRecurringCandidates({ transactions: rent });

    expect(found.name).toBe("Landlord");
    expect(found.monthsSeen).toBe(3);
    expect(found.typicalAmount).toBe(1_500_000);
    expect(found.typicalDay).toBe(1);
  });

  it("needs three months before calling it a pattern", () => {
    expect(detectRecurringCandidates({ transactions: rent.slice(0, 2) })).toEqual([]);
  });

  it("leaves a daily habit alone, however often it repeats", () => {
    const boda = Array.from({ length: 60 }, (_, index) =>
      transaction({
        id: `boda:${index}`,
        payee: "Boda Rider",
        amount: 8_000,
        categoryId: "cat:boda",
        occurredOn: `2026-0${6 + Math.floor(index / 20)}-${String((index % 20) + 1).padStart(2, "0")}`,
      }),
    );

    expect(detectRecurringCandidates({ transactions: boda })).toEqual([]);
  });

  it("leaves an amount that swings wildly alone", () => {
    const erratic = [200_000, 20_000, 900_000].map((amount, index) =>
      transaction({
        id: `x:${index}`,
        payee: "Hardware Shop",
        amount,
        occurredOn: `2026-0${6 + index}-05`,
      }),
    );

    expect(detectRecurringCandidates({ transactions: erratic })).toEqual([]);
  });

  it("skips what is already tracked as an obligation", () => {
    expect(
      detectRecurringCandidates({ transactions: rent, trackedPayees: ["landlord"] }),
    ).toEqual([]);
  });

  it("ignores charges, which follow a payment rather than recur on their own", () => {
    const fees = ["2026-06-01", "2026-07-01", "2026-08-01"].map((occurredOn, index) =>
      transaction({
        id: `fee:${index}`,
        occurredOn,
        amount: 20_000,
        categoryId: feesCategoryId(USER),
        payee: "Airtel",
      }),
    );

    expect(detectRecurringCandidates({ transactions: fees })).toEqual([]);
  });

  it("ignores a transfer, which moves money rather than spending it", () => {
    const moves = ["2026-06-01", "2026-07-01", "2026-08-01"].map((occurredOn, index) =>
      transaction({
        id: `mv:${index}`,
        occurredOn,
        type: "transfer",
        amount: -500_000,
        transferGroupId: `g:${index}`,
        payee: "Own Transfer",
      }),
    );

    expect(detectRecurringCandidates({ transactions: moves })).toEqual([]);
  });

  it("ignores something too small to be worth tracking", () => {
    const small = ["2026-06-01", "2026-07-01", "2026-08-01"].map((occurredOn, index) =>
      transaction({ id: `s:${index}`, occurredOn, amount: 500, payee: "Kiosk" }),
    );

    expect(detectRecurringCandidates({ transactions: small })).toEqual([]);
  });

  it("puts the largest bill first", () => {
    const utilities = ["2026-06-03", "2026-07-03", "2026-08-03"].map((occurredOn, index) =>
      transaction({ id: `u:${index}`, occurredOn, amount: 60_000, payee: "UEDCL" }),
    );

    const found = detectRecurringCandidates({ transactions: [...utilities, ...rent] });

    expect(found.map((entry) => entry.name)).toEqual(["Landlord", "UEDCL"]);
  });

  it("reads the day it usually falls on, not the day of the first one", () => {
    const shifted = ["2026-06-14", "2026-07-15", "2026-08-15"].map((occurredOn, index) =>
      transaction({ id: `d:${index}`, occurredOn, payee: "School" }),
    );

    expect(detectRecurringCandidates({ transactions: shifted })[0].typicalDay).toBe(15);
  });
});
