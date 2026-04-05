import type { Transaction } from "@/lib/types";

export function isTransferTransaction(transaction: Transaction): boolean {
  return transaction.type === "transfer" || transaction.categoryId === "category:transfers";
}

export function excludeTransfers(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => !isTransferTransaction(transaction));
}
