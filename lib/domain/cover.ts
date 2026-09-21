import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { LIQUID_ACCOUNT_TYPES } from "@/lib/domain/runway";
import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Transaction } from "@/lib/types";

// How many months of spending the app treats as a full moat.
export const TARGET_COVER_MONTHS = 3;

// Cover is a question about months, so its denominator has to be a month. It is
// read from complete calendar months only: the month in progress is a partial
// month, and dividing by a week of spending or by three days of it is what made
// the old figure move whenever the dashboard filter moved.
export const COVER_BASELINE_WINDOW_MONTHS = 6;
export const COVER_BASELINE_MIN_MONTHS = 2;

export type CoverStatus = {
  /** Balances that could actually be spent this month. */
  reserves: number;
  /** Average spending per complete month, or 0 when there is no baseline yet. */
  monthlySpend: number;
  /** Complete months the average was taken over. */
  monthsMeasured: number;
  /** Months of cover, or null when there is not enough history to say. */
  months: number | null;
  targetMonths: number;
  /** One line naming what the figure was calculated from. */
  basis: string;
};

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(now: Date, offset: number): string {
  return monthKeyOf(new Date(now.getFullYear(), now.getMonth() + offset, 1));
}

// A SACCO share, an investment holding and a receivable are all money you would
// have to get back before you could spend it, so none of them are reserves.
export function getAccessibleReserves(accounts: Account[]): number {
  return accounts
    .filter((account) => !account.isArchived && LIQUID_ACCOUNT_TYPES.includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
}

export function getMonthlySpendBaseline(
  transactions: Transaction[],
  now: Date,
): { amount: number; monthsMeasured: number } {
  // History starts at the first record of any kind. A complete month in which
  // nothing was spent is a real zero, but a month before the user arrived is
  // an absence, and averaging absences in would halve the denominator.
  const firstRecordedMonth = transactions.reduce<string | null>(
    (held, transaction) =>
      held === null || transaction.occurredOn < held ? transaction.occurredOn : held,
    null,
  );

  if (firstRecordedMonth === null) {
    return { amount: 0, monthsMeasured: 0 };
  }

  const firstKey = firstRecordedMonth.slice(0, 7);
  const months = Array.from({ length: COVER_BASELINE_WINDOW_MONTHS }, (_, index) =>
    shiftMonthKey(now, index - COVER_BASELINE_WINDOW_MONTHS),
  ).filter((key) => key >= firstKey);

  if (months.length === 0) {
    return { amount: 0, monthsMeasured: 0 };
  }

  const measured = new Set(months);
  const spent = transactions.reduce((sum, transaction) => {
    if (isTransferTransaction(transaction) || !isSpendingTransaction(transaction)) {
      return sum;
    }
    if (!measured.has(transaction.occurredOn.slice(0, 7))) {
      return sum;
    }

    return sum + Math.abs(getTransactionBalanceDelta(transaction));
  }, 0);

  return { amount: spent / months.length, monthsMeasured: months.length };
}

export function getCoverStatus(params: {
  accounts: Account[];
  transactions: Transaction[];
  now: Date;
}): CoverStatus {
  const reserves = getAccessibleReserves(params.accounts);
  const { amount, monthsMeasured } = getMonthlySpendBaseline(params.transactions, params.now);
  const hasBaseline = monthsMeasured >= COVER_BASELINE_MIN_MONTHS && amount > 0;

  return {
    reserves,
    monthlySpend: hasBaseline ? amount : 0,
    monthsMeasured,
    months: hasBaseline ? Math.max(0, reserves) / amount : null,
    targetMonths: TARGET_COVER_MONTHS,
    basis: hasBaseline
      ? `Cash, mobile money and bank balances, divided by your average spending over the last ${monthsMeasured} complete ${monthsMeasured === 1 ? "month" : "months"}.`
      : `Needs ${COVER_BASELINE_MIN_MONTHS} complete months of records to work out typical spending. ${monthsMeasured === 0 ? "None" : `Only ${monthsMeasured}`} so far.`,
  };
}
