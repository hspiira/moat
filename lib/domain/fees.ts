import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Transaction } from "@/lib/types";

export type FeeLoad = {
  fees: number;
  count: number;
  movedOut: number;
  share: number;
};

export function isFeeTransaction(transaction: Transaction): boolean {
  return (
    Boolean(transaction.feeParentId) ||
    transaction.categoryId === feesCategoryId(transaction.userId)
  );
}

// What it costs to move money, and against what. movedOut counts every
// non-fee row that reduces an account, so an expense, a debt payment and the
// leaving leg of a transfer all count, which is where charges are incurred.
export function getFeeLoad(transactions: Transaction[]): FeeLoad {
  let fees = 0;
  let count = 0;
  let movedOut = 0;

  for (const transaction of transactions) {
    if (isFeeTransaction(transaction)) {
      fees += Math.abs(transaction.amount);
      count += 1;
      continue;
    }

    const delta = getTransactionBalanceDelta(transaction);
    if (delta < 0) {
      movedOut += Math.abs(delta);
    }
  }

  return {
    fees,
    count,
    movedOut,
    share: movedOut > 0 ? fees / movedOut : 0,
  };
}
