import type { Transaction } from "@/lib/types";

/**
 * Every transaction that must go when one is deleted.
 *
 * A single user action can write several rows. A transfer is a balanced pair,
 * a loan repayment is that pair plus an interest expense, and any of those can
 * carry a linked fee. Deleting one row and leaving the rest behind breaks the
 * ledger: a half-deleted transfer no longer nets to zero, and an orphaned
 * interest expense keeps reducing net worth for a payment that no longer
 * exists.
 *
 * This lived inline in the transactions hook, which is why the orphaned
 * interest row went unnoticed. It is a pure function so the cascade can be
 * tested on its own.
 */
export function planTransactionCascade(
  transaction: Transaction,
  transactions: Transaction[],
): Set<string> {
  const ids = new Set<string>([transaction.id]);

  // Rows written together as one movement share a group: both legs of a
  // transfer, and the interest leg of a loan repayment.
  if (transaction.transferGroupId) {
    for (const entry of transactions) {
      if (entry.transferGroupId === transaction.transferGroupId) {
        ids.add(entry.id);
      }
    }
  }

  // Fees hang off whichever row they were charged against, which may be one
  // the group above just pulled in. Repeat until nothing new appears so a fee
  // on a transfer source is caught too.
  let added = true;
  while (added) {
    added = false;
    for (const entry of transactions) {
      if (entry.feeParentId && ids.has(entry.feeParentId) && !ids.has(entry.id)) {
        ids.add(entry.id);
        added = true;
      }
    }
  }

  return ids;
}

/** The rows written together with this one, including itself. */
export function transactionGroup(
  transaction: Transaction,
  transactions: Transaction[],
): Transaction[] {
  if (!transaction.transferGroupId) {
    return [transaction];
  }
  return transactions.filter(
    (entry) => entry.transferGroupId === transaction.transferGroupId,
  );
}

/**
 * Whether a transfer can be edited in place.
 *
 * A plain transfer is two balanced legs and can simply be rebuilt. A loan
 * repayment is those legs plus an interest expense, and its split was computed
 * against the loan balance and elapsed time *as they were on the day*. Both
 * have since moved, so rebuilding it now would produce a different split and
 * silently restate what was paid. Those stay delete-and-re-enter until the
 * split is stored rather than recomputed.
 */
export function isEditableTransfer(
  transaction: Transaction,
  transactions: Transaction[],
): boolean {
  if (transaction.type !== "transfer") {
    return false;
  }
  const group = transactionGroup(transaction, transactions);
  return group.length === 2 && group.every((entry) => entry.type === "transfer");
}

/** The negative and positive legs of a transfer pair, by sign. */
export function transferLegs(
  transaction: Transaction,
  transactions: Transaction[],
): { source: Transaction; destination: Transaction } | null {
  const group = transactionGroup(transaction, transactions);
  const source = group.find((entry) => entry.amount < 0);
  const destination = group.find((entry) => entry.amount > 0);
  return source && destination ? { source, destination } : null;
}
