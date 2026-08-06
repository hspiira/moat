import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { getAggregateBalanceAtDate, getChangePercent, type ChangeMetric } from "@/lib/domain/dashboard";
import type { Account, Transaction } from "@/lib/types";

export type PositionPoint = {
  date: string;
  balance: number;
};

export type PositionSeries = {
  points: PositionPoint[];
  change: number;
  changePercent: ChangeMetric;
};

export type CalendarCell = {
  date: string;
  day: number;
  net: number;
  hasActivity: boolean;
};

export type FlowBreakdown = {
  inflow: number;
  inflowCount: number;
  outflow: number;
  outflowCount: number;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Aggregate position, one point per day for the trailing window. Seeded with
 * the balance the day before the window opens, then walked forward by summing
 * each day's transaction deltas — one pass, not one balance query per day.
 */
export function buildPositionSeries(
  accounts: Account[],
  transactions: Transaction[],
  days: number,
  now: Date,
): PositionSeries {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

  const deltasByDay = new Map<string, number>();
  for (const transaction of transactions) {
    deltasByDay.set(
      transaction.occurredOn,
      (deltasByDay.get(transaction.occurredOn) ?? 0) + getTransactionBalanceDelta(transaction),
    );
  }

  let balance = getAggregateBalanceAtDate(accounts, transactions, start);
  const points: PositionPoint[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const key = toDateKey(day);
    balance += deltasByDay.get(key) ?? 0;
    points.push({ date: key, balance });
  }

  const first = points[0]?.balance ?? 0;
  const last = points[points.length - 1]?.balance ?? 0;

  return {
    points,
    change: last - first,
    changePercent: getChangePercent(last, first),
  };
}

/** Net movement per day for one month ("YYYY-MM"), one cell per calendar day. */
export function buildDailyNetCalendar(transactions: Transaction[], month: string): CalendarCell[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  const cells = new Map<string, { net: number; hasActivity: boolean }>();
  for (const transaction of transactions) {
    if (!transaction.occurredOn.startsWith(month)) continue;
    const entry = cells.get(transaction.occurredOn) ?? { net: 0, hasActivity: false };
    entry.net += getTransactionBalanceDelta(transaction);
    entry.hasActivity = true;
    cells.set(transaction.occurredOn, entry);
  }

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const entry = cells.get(date);
    return {
      date,
      day,
      net: entry?.net ?? 0,
      hasActivity: entry?.hasActivity ?? false,
    };
  });
}

/** Totals and how often money moved, for a window's transactions. */
export function getFlowBreakdown(transactions: Transaction[]): FlowBreakdown {
  let inflow = 0;
  let inflowCount = 0;
  let outflow = 0;
  let outflowCount = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      inflow += Math.abs(transaction.amount);
      inflowCount += 1;
    } else if (
      transaction.type === "expense" ||
      transaction.type === "savings_contribution" ||
      transaction.type === "debt_payment"
    ) {
      outflow += Math.abs(transaction.amount);
      outflowCount += 1;
    }
  }

  return { inflow, inflowCount, outflow, outflowCount };
}

export type AllocationSlice = {
  key: string;
  label: string;
  amount: number;
  share: number;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank",
  sacco: "SACCO",
  investment: "Investment",
  debt: "Debt",
  receivable: "Owed to you",
};

/**
 * Where the money actually sits, by account type. Debt and receivable accounts
 * are excluded: they are claims, not holdings, and folding a negative balance
 * into a share-of-total makes every other slice lie.
 */
export function getAllocation(accounts: Account[]): AllocationSlice[] {
  const totals = new Map<string, number>();

  for (const account of accounts) {
    if (account.isArchived) continue;
    if (account.type === "debt" || account.type === "receivable") continue;
    if (account.balance <= 0) continue;
    totals.set(account.type, (totals.get(account.type) ?? 0) + account.balance);
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: ACCOUNT_TYPE_LABELS[key] ?? key,
      amount,
      share: amount / total,
    }))
    .sort((left, right) => right.amount - left.amount);
}

/** "1.2M", "45k" — amounts short enough to live inside a calendar cell. */
export function formatCompactAmount(amount: number): string {
  const magnitude = Math.abs(amount);
  if (magnitude >= 1_000_000) {
    const value = magnitude / 1_000_000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (magnitude >= 1_000) {
    return `${Math.round(magnitude / 1_000)}k`;
  }
  return String(Math.round(magnitude));
}
