import { isFeeTransaction } from "@/lib/domain/fees";
import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type { Transaction } from "@/lib/types";

export type RecurringCandidate = {
  key: string;
  name: string;
  categoryId: string;
  monthsSeen: number;
  typicalAmount: number;
  typicalDay: number;
  lastSeenOn: string;
};

const MIN_MONTHS = 3;
const MAX_PER_MONTH = 1.5;
const AMOUNT_TOLERANCE = 0.35;
const MIN_AMOUNT = 5_000;

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function payeeKey(transaction: Transaction): string | null {
  const payee = (transaction.payee ?? transaction.rawPayee ?? "").trim().toLowerCase();
  return payee.replace(/\s+/g, " ") || null;
}

type Bucket = {
  name: string;
  categoryId: string;
  byMonth: Map<string, number[]>;
  days: number[];
  lastSeenOn: string;
};

// A monthly bill looks like one charge a month, in several months, for about
// the same amount. That is what separates rent from 35 boda trips: both repeat,
// but only one of them repeats once a month.
export function detectRecurringCandidates(params: {
  transactions: Transaction[];
  trackedPayees?: string[];
  now?: Date;
}): RecurringCandidate[] {
  const tracked = new Set(
    (params.trackedPayees ?? []).map((name) => name.trim().toLowerCase()),
  );
  const buckets = new Map<string, Bucket>();

  for (const transaction of params.transactions) {
    if (isTransferTransaction(transaction) || !isSpendingTransaction(transaction)) continue;
    if (isFeeTransaction(transaction)) continue;

    const key = payeeKey(transaction);
    if (!key || tracked.has(key)) continue;

    const month = transaction.occurredOn.slice(0, 7);
    const amount = Math.abs(transaction.amount);
    const held = buckets.get(key) ?? {
      name: (transaction.payee ?? transaction.rawPayee ?? "").trim(),
      categoryId: transaction.categoryId,
      byMonth: new Map<string, number[]>(),
      days: [],
      lastSeenOn: transaction.occurredOn,
    };

    held.byMonth.set(month, [...(held.byMonth.get(month) ?? []), amount]);
    held.days.push(Number(transaction.occurredOn.slice(8, 10)));
    if (transaction.occurredOn > held.lastSeenOn) held.lastSeenOn = transaction.occurredOn;
    buckets.set(key, held);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [key, bucket] of buckets) {
    const months = [...bucket.byMonth.keys()];
    if (months.length < MIN_MONTHS) continue;

    const perMonth = [...bucket.byMonth.values()].map((amounts) => amounts.length);
    const average = perMonth.reduce((sum, count) => sum + count, 0) / perMonth.length;
    if (average > MAX_PER_MONTH) continue;

    const monthlyTotals = [...bucket.byMonth.values()].map((amounts) =>
      amounts.reduce((sum, amount) => sum + amount, 0),
    );
    const typicalAmount = median(monthlyTotals);
    if (typicalAmount < MIN_AMOUNT) continue;

    const steady = monthlyTotals.filter(
      (total) => Math.abs(total - typicalAmount) <= typicalAmount * AMOUNT_TOLERANCE,
    );
    if (steady.length * 2 < monthlyTotals.length) continue;

    candidates.push({
      key,
      name: bucket.name,
      categoryId: bucket.categoryId,
      monthsSeen: months.length,
      typicalAmount,
      typicalDay: median(bucket.days),
      lastSeenOn: bucket.lastSeenOn,
    });
  }

  return candidates.sort((left, right) => right.typicalAmount - left.typicalAmount);
}
