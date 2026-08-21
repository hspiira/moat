import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import { todayIso } from "@/lib/today";
import type { Account, AccountType, Transaction } from "@/lib/types";

// What could be spent this week. A SACCO share or an investment holding is
// savings you would have to liquidate, and a receivable is somebody else's
// promise, so none of them belong in a question about running out of money.
export const LIQUID_ACCOUNT_TYPES: readonly AccountType[] = ["cash", "mobile_money", "bank"];

const DEFAULT_LOOKBACK_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

export type Runway = {
  liquid: number;
  dailyBurn: number;
  daysMeasured: number;
  daysCovered: number | null;
  runsOutOn: string | null;
};

function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: string, to: Date): number {
  const [year, month, day] = from.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / MILLISECONDS_PER_DAY);
}

export function getRunway(params: {
  accounts: Account[];
  transactions: Transaction[];
  now: Date;
  lookbackDays?: number;
}): Runway {
  const lookbackDays = params.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const from = todayIso(addDays(params.now, -lookbackDays));
  const today = todayIso(params.now);

  const liquid = params.accounts
    .filter((account) => !account.isArchived && LIQUID_ACCOUNT_TYPES.includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);

  const window = params.transactions.filter(
    (transaction) =>
      transaction.occurredOn >= from &&
      transaction.occurredOn <= today &&
      !isTransferTransaction(transaction) &&
      isSpendingTransaction(transaction),
  );

  const spent = window.reduce(
    (sum, transaction) => sum + Math.abs(getTransactionBalanceDelta(transaction)),
    0,
  );

  // Divide by the history that actually exists. Five days of entries over a
  // thirty day window is a five day average, and calling it a thirty day one
  // would understate the burn by six times.
  const earliest = window.reduce<string | null>(
    (held, transaction) =>
      held === null || transaction.occurredOn < held ? transaction.occurredOn : held,
    null,
  );
  const daysMeasured = earliest
    ? Math.min(lookbackDays, Math.max(1, daysBetween(earliest, params.now) + 1))
    : 0;

  const dailyBurn = daysMeasured > 0 ? spent / daysMeasured : 0;

  if (dailyBurn <= 0) {
    return { liquid, dailyBurn: 0, daysMeasured, daysCovered: null, runsOutOn: null };
  }

  const daysCovered = Math.max(0, Math.floor(liquid / dailyBurn));

  return {
    liquid,
    dailyBurn: Math.round(dailyBurn),
    daysMeasured,
    daysCovered,
    runsOutOn: todayIso(addDays(params.now, daysCovered)),
  };
}
