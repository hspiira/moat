import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { Transaction } from "@/lib/types";

export type ReconcileWindow = {
  gap: number;
  statedBalance: number;
  expectedBalance: number;
  statedOn: string;
  openedOn: string;
  entries: Transaction[];
};

const TOLERANCE = 1;

function inLedgerOrder(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) =>
    left.occurredOn === right.occurredOn
      ? left.createdAt.localeCompare(right.createdAt)
      : left.occurredOn.localeCompare(right.occurredOn),
  );
}

// The error sits between the last two balances a message stated: everything
// before the first was already agreed, and nothing after the second is counted
// yet. Narrowing to that window is the whole point, because a whole account's
// history is too much to check by eye.
export function getReconcileWindow(accountTransactions: Transaction[]): ReconcileWindow | null {
  const sorted = inLedgerOrder(accountTransactions);

  let previousStated: number | null = null;
  let openedOn: string | null = null;
  let sinceCheckpoint: Transaction[] = [];
  let latest: ReconcileWindow | null = null;

  for (const transaction of sorted) {
    sinceCheckpoint.push(transaction);

    if (typeof transaction.statedBalance !== "number") continue;

    if (previousStated !== null && openedOn !== null) {
      const counted = sinceCheckpoint.reduce(
        (sum, entry) => sum + getTransactionBalanceDelta(entry),
        0,
      );
      const gap = Math.round(transaction.statedBalance - previousStated - counted);

      if (Math.abs(gap) >= TOLERANCE) {
        latest = {
          gap,
          statedBalance: transaction.statedBalance,
          expectedBalance: previousStated + counted,
          statedOn: transaction.occurredOn,
          openedOn,
          entries: sinceCheckpoint,
        };
      }
    }

    previousStated = transaction.statedBalance;
    openedOn = transaction.occurredOn;
    sinceCheckpoint = [];
  }

  return latest;
}
