import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { CaptureReviewItem, Transaction } from "@/lib/types";

export type BalanceGap = {
  transactionId: string;
  gap: number;
  statedBalance: number;
  expectedBalance: number;
};

const TOLERANCE = 1;

export function detectBalanceGaps(transactions: Transaction[]): BalanceGap[] {
  const sorted = [...transactions].sort((a, b) =>
    a.occurredOn === b.occurredOn
      ? a.createdAt.localeCompare(b.createdAt)
      : a.occurredOn.localeCompare(b.occurredOn),
  );

  const gaps: BalanceGap[] = [];
  let previousStated: number | null = null;
  let deltaSinceCheckpoint = 0;

  for (const transaction of sorted) {
    deltaSinceCheckpoint += getTransactionBalanceDelta(transaction);

    if (typeof transaction.statedBalance === "number") {
      if (previousStated !== null) {
        const actualDelta = transaction.statedBalance - previousStated;
        const gap = actualDelta - deltaSinceCheckpoint;
        if (Math.abs(gap) >= TOLERANCE) {
          gaps.push({
            transactionId: transaction.id,
            gap: Math.round(gap),
            statedBalance: transaction.statedBalance,
            expectedBalance: previousStated + deltaSinceCheckpoint,
          });
        }
      }
      previousStated = transaction.statedBalance;
      deltaSinceCheckpoint = 0;
    }
  }

  return gaps;
}

export type BalanceGapSubject = Pick<
  CaptureReviewItem,
  | "id"
  | "accountId"
  | "type"
  | "normalizedAmount"
  | "currency"
  | "originalAmount"
  | "occurredOn"
  | "categoryId"
  | "source"
  | "statedBalance"
> & {
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function pendingReviewGap(
  item: BalanceGapSubject,
  ledger: Transaction[],
): BalanceGap | null {
  if (typeof item.statedBalance !== "number") {
    return null;
  }

  const synthetic: Transaction = {
    id: item.id,
    userId: item.userId ?? "",
    accountId: item.accountId,
    type: item.type,
    amount: Math.abs(item.normalizedAmount),
    currency: item.currency,
    originalAmount: Math.abs(item.originalAmount),
    occurredOn: item.occurredOn,
    categoryId: item.categoryId,
    reconciliationState: "reviewed",
    source: item.source,
    statedBalance: item.statedBalance,
    createdAt: item.createdAt ?? item.occurredOn,
    updatedAt: item.updatedAt ?? item.occurredOn,
  };

  const accountLedger = ledger.filter((entry) => entry.accountId === item.accountId);
  return (
    detectBalanceGaps([...accountLedger, synthetic]).find(
      (gap) => gap.transactionId === item.id,
    ) ?? null
  );
}
