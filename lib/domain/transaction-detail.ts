import type { Transaction } from "@/lib/types";

export type TransactionDetail = {
  subject: Transaction;
  fee: Transaction | null;
  parent: Transaction | null;
  totalOffAccount: number;
};

export function getTransactionDetail(
  transaction: Transaction,
  transactions: Transaction[],
): TransactionDetail {
  const parent = transaction.feeParentId
    ? (transactions.find((entry) => entry.id === transaction.feeParentId) ?? null)
    : null;

  const subject = parent ?? transaction;

  const fee =
    transactions.find((entry) => entry.feeParentId === subject.id) ??
    (parent ? transaction : null);

  return {
    subject,
    fee: fee ?? null,
    parent,
    totalOffAccount: Math.abs(subject.amount) + Math.abs(fee?.amount ?? 0),
  };
}
