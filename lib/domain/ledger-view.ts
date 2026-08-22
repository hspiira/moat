import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { Transaction } from "@/lib/types";

export const LEDGER_WINDOWS = [7, 30, 90] as const;

export type LedgerWindow = (typeof LEDGER_WINDOWS)[number] | null;
export type LedgerSort = "recent" | "largest";

export function parseLedgerWindow(value: string | null): LedgerWindow {
  const days = Number(value);
  return LEDGER_WINDOWS.find((window) => window === days) ?? null;
}

export function parseLedgerSort(value: string | null): LedgerSort {
  return value === "largest" ? "largest" : "recent";
}

// Counting back from today rather than from the newest entry, so an account left
// untouched for a month shows an empty week instead of its last busy week.
export function windowStartsOn(days: number, today: string): string {
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - (days - 1));
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${start.getFullYear()}-${month}-${day}`;
}

export function filterByWindow(
  transactions: Transaction[],
  days: LedgerWindow,
  today: string,
): Transaction[] {
  if (days === null) return transactions;
  const from = windowStartsOn(days, today);
  return transactions.filter((transaction) => transaction.occurredOn >= from);
}

// Largest means most money actually gone. An inflow is not spending, and a
// transfer between your own accounts has not left your hands, so neither can
// outrank what you came here to look at.
function moneyGone(transaction: Transaction): number {
  if (transaction.type === "transfer") return 0;
  return Math.max(0, -getTransactionBalanceDelta(transaction));
}

export function sortForLedger(transactions: Transaction[], sort: LedgerSort): Transaction[] {
  if (sort === "recent") return transactions;

  return [...transactions].sort((left, right) => {
    const byOutflow = moneyGone(right) - moneyGone(left);
    if (byOutflow !== 0) return byOutflow;
    return right.occurredOn.localeCompare(left.occurredOn);
  });
}
