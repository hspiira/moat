import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Transaction } from "@/lib/types";

export type FeeLoad = {
  fees: number;
  count: number;
  moved: number;
  share: number;
};

export function isFeeTransaction(transaction: Transaction): boolean {
  return (
    Boolean(transaction.feeParentId) ||
    transaction.categoryId === feesCategoryId(transaction.userId)
  );
}

// What it costs to move money, and against what. Money coming in is charged
// too, so income counts. A transfer counts its leaving leg only, or the one
// movement would be counted twice, once on each account.
export function getFeeLoad(transactions: Transaction[]): FeeLoad {
  let fees = 0;
  let count = 0;
  let moved = 0;

  for (const transaction of transactions) {
    if (isFeeTransaction(transaction)) {
      fees += Math.abs(transaction.amount);
      count += 1;
      continue;
    }

    const delta = getTransactionBalanceDelta(transaction);
    if (delta < 0 || transaction.type === "income") {
      moved += Math.abs(delta);
    }
  }

  return {
    fees,
    count,
    moved,
    share: moved > 0 ? fees / moved : 0,
  };
}

export type AccountFeeLoad = FeeLoad & {
  accountId: string;
  // Total cost says what you paid; the rate says whether the account is dear.
  // An account you move a lot through will always show the larger total, so
  // without the rate the busiest account looks like the most expensive one.
  costPerThousandMoved: number;
};

export function getFeeLoadByAccount(transactions: Transaction[]): AccountFeeLoad[] {
  const byAccount = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    byAccount.set(transaction.accountId, [
      ...(byAccount.get(transaction.accountId) ?? []),
      transaction,
    ]);
  }

  return [...byAccount.entries()]
    .map(([accountId, rows]) => {
      const load = getFeeLoad(rows);
      return {
        ...load,
        accountId,
        costPerThousandMoved: load.moved > 0 ? (load.fees / load.moved) * 1_000 : 0,
      };
    })
    .filter((load) => load.fees > 0)
    .sort((left, right) => right.fees - left.fees);
}

// The account that stings most per shilling moved, among those you actually use
// enough for the rate to mean anything.
export function dearestAccountToMoveFrom(
  transactions: Transaction[],
  minimumMoved: number,
): AccountFeeLoad | null {
  const usable = getFeeLoadByAccount(transactions).filter(
    (load) => load.moved >= minimumMoved,
  );
  if (usable.length === 0) return null;

  return usable.reduce((held, load) =>
    load.costPerThousandMoved > held.costPerThousandMoved ? load : held,
  );
}
