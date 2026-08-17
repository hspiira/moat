import { transfersCategoryId } from "@/lib/domain/seeded-ids";
import type { Transaction } from "@/lib/types";

export function isTransferTransaction(transaction: Transaction): boolean {
  return (
    transaction.type === "transfer" ||
    transaction.categoryId === transfersCategoryId(transaction.userId)
  );
}

export function isSpendingTransaction(transaction: Transaction): boolean {
  return transaction.type === "expense" || transaction.type === "debt_payment";
}

export function excludeTransfers(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => !isTransferTransaction(transaction));
}
