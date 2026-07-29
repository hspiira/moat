import type { Transaction } from "@/lib/types";

export type TransactionDetail = {
  /**
   * The transaction the detail view is actually about. Asking for a fee row
   * resolves to the payment it was charged against — a fee is never its own
   * subject, because on its own it says nothing about what was bought.
   */
  subject: Transaction;
  /** The fee charged against the subject, when one was recorded. */
  fee: Transaction | null;
  /** Set when the caller asked about a fee: the payment it belongs to. */
  parent: Transaction | null;
  /** Subject plus fee — what actually left the account. */
  totalOffAccount: number;
};

export function getTransactionDetail(
  transaction: Transaction,
  transactions: Transaction[],
): TransactionDetail {
  const parent = transaction.feeParentId
    ? (transactions.find((entry) => entry.id === transaction.feeParentId) ?? null)
    : null;

  // An orphaned fee — its parent deleted out from under it — still deserves to
  // be viewable, so it becomes its own subject rather than resolving to nothing.
  const subject = parent ?? transaction;

  const fee =
    transactions.find((entry) => entry.feeParentId === subject.id) ??
    (parent ? transaction : null);

  return {
    subject,
    fee: fee ?? null,
    parent,
    totalOffAccount: subject.amount + (fee?.amount ?? 0),
  };
}
