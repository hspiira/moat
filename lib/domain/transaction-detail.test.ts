import { describe, expect, it } from "vitest";

import type { Transaction } from "@/lib/types";

import { getTransactionDetail } from "./transaction-detail";

function transaction(
  values: Partial<Transaction> & Pick<Transaction, "id">,
): Transaction {
  return {
    userId: "u1",
    accountId: "acc-1",
    type: "expense",
    amount: 86_400,
    currency: "UGX",
    originalAmount: 86_400,
    occurredOn: "2026-07-24",
    categoryId: "cat-groceries",
    reconciliationState: "posted",
    source: "sms",
    createdAt: "2026-07-24T08:00:00.000Z",
    updatedAt: "2026-07-24T08:00:00.000Z",
    ...values,
  };
}

const payment = transaction({ id: "transaction:1", payee: "Shoprite" });
const fee = transaction({
  id: "transaction:1:fee",
  amount: 500,
  originalAmount: 500,
  categoryId: "category:fees",
  note: "Fee / charges",
  feeParentId: "transaction:1",
});

const transferOut = transaction({
  id: "transaction:2",
  type: "transfer",
  amount: -200_000,
  originalAmount: 200_000,
  categoryId: "cat-transfers",
  payee: "Suzan",
  transferGroupId: "group:1",
});

const transferFee = transaction({
  id: "transaction:2:fee",
  amount: 1_725,
  originalAmount: 1_725,
  categoryId: "category:fees",
  note: "Fee / charges",
  feeParentId: "transaction:2",
});

describe("getTransactionDetail", () => {
  it("charges a transfer fee on top of the amount sent, not out of it", () => {
    const detail = getTransactionDetail(transferOut, [transferOut, transferFee]);

    expect(detail.totalOffAccount).toBe(201_725);
  });

  it("reads the same total when the fee itself is opened", () => {
    const detail = getTransactionDetail(transferFee, [transferOut, transferFee]);

    expect(detail.subject).toBe(transferOut);
    expect(detail.totalOffAccount).toBe(201_725);
  });

  it("attaches the fee charged against a payment", () => {
    const detail = getTransactionDetail(payment, [payment, fee]);
    expect(detail.subject).toBe(payment);
    expect(detail.fee).toBe(fee);
    expect(detail.parent).toBeNull();
    expect(detail.totalOffAccount).toBe(86_900);
  });

  it("leaves a payment with no fee alone", () => {
    const detail = getTransactionDetail(payment, [payment]);
    expect(detail.fee).toBeNull();
    expect(detail.totalOffAccount).toBe(86_400);
  });

  it("promotes a fee to its parent, because a fee is never its own subject", () => {
    const detail = getTransactionDetail(fee, [payment, fee]);
    expect(detail.subject).toBe(payment);
    expect(detail.fee).toBe(fee);
    expect(detail.parent).toBe(payment);
    expect(detail.totalOffAccount).toBe(86_900);
  });

  it("keeps an orphaned fee viewable after its parent is deleted", () => {
    const detail = getTransactionDetail(fee, [fee]);
    expect(detail.subject).toBe(fee);
    expect(detail.fee).toBeNull();
    expect(detail.parent).toBeNull();
    expect(detail.totalOffAccount).toBe(500);
  });

  it("does not total an inflow against a fee it never had", () => {
    const salary = transaction({ id: "transaction:2", type: "income", amount: 2_400_000 });
    const detail = getTransactionDetail(salary, [salary]);
    expect(detail.totalOffAccount).toBe(2_400_000);
    expect(detail.fee).toBeNull();
  });

  it("matches the fee by parent id, not by proximity", () => {
    const otherFee = transaction({
      id: "transaction:9:fee",
      amount: 900,
      feeParentId: "transaction:9",
    });
    const detail = getTransactionDetail(payment, [payment, otherFee]);
    expect(detail.fee).toBeNull();
  });
});
