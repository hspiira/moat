import type { Transaction } from "@/lib/types";

export function planTransactionCascade(
  transaction: Transaction,
  transactions: Transaction[],
): Set<string> {
  const ids = new Set<string>([transaction.id]);

  if (transaction.transferGroupId) {
    for (const entry of transactions) {
      if (entry.transferGroupId === transaction.transferGroupId) {
        ids.add(entry.id);
      }
    }
  }

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

export function isEditableTransaction(
  transaction: Transaction,
  transactions: Transaction[],
): boolean {
  if (transaction.feeParentId) {
    return false;
  }
  if (transaction.transferGroupId) {
    return isEditableTransfer(transaction, transactions);
  }
  return true;
}

export function transferLegs(
  transaction: Transaction,
  transactions: Transaction[],
): { source: Transaction; destination: Transaction } | null {
  const group = transactionGroup(transaction, transactions);
  const source = group.find((entry) => entry.amount < 0);
  const destination = group.find((entry) => entry.amount > 0);
  return source && destination ? { source, destination } : null;
}
