import { getAggregateOpeningBalance } from "@/lib/domain/summaries";
import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";

export type PeriodFilter = "week" | "month" | "year" | "all";

export type PeriodWindow = {
  current: Transaction[];
  previous: Transaction[];
  currentStart: Date | null;
  title: string;
  caption: string;
  comparisonLabel: string | null;
  overviewLabel: string;
};

export type ChangeMetric = {
  kind: "delta" | "new" | "none";
  value: number | null;
};

export function getPeriodOverviewLabel(period: PeriodFilter, now: Date) {
  if (period === "week") return "This week";
  if (period === "year") return now.getFullYear().toString();
  if (period === "all") return "All lifetime";

  return new Intl.DateTimeFormat("en-UG", {
    month: "long",
    year: "numeric",
  }).format(now);
}

export function getPeriodChartLabel(period: PeriodFilter) {
  if (period === "week") return "Week";
  if (period === "year") return "Year";
  if (period === "all") return "Lifetime";
  return "Month";
}

export function getChangePercent(current: number, previous: number): ChangeMetric {
  if (previous === 0 && current === 0) return { kind: "none", value: null };
  if (previous === 0) return { kind: "new", value: null };

  return {
    kind: "delta",
    value: ((current - previous) / previous) * 100,
  };
}

export function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfYear(date: Date) {
  const copy = new Date(date);
  copy.setMonth(0, 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function shiftDate(date: Date, unit: "week" | "month" | "year", amount: number) {
  const copy = new Date(date);
  if (unit === "week") copy.setDate(copy.getDate() + amount * 7);
  if (unit === "month") copy.setMonth(copy.getMonth() + amount);
  if (unit === "year") copy.setFullYear(copy.getFullYear() + amount);
  return copy;
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  start: Date,
  end: Date,
) {
  return transactions.filter((transaction) => {
    const occurredOn = new Date(`${transaction.occurredOn}T00:00:00`);
    return occurredOn >= start && occurredOn < end;
  });
}

export function buildPeriodWindow(
  transactions: Transaction[],
  period: PeriodFilter,
  now: Date,
): PeriodWindow {
  if (period === "all") {
    const yearStart = startOfYear(now);

    return {
      current: transactions,
      previous: filterTransactionsByRange(transactions, new Date(0), yearStart),
      currentStart: null,
      title: "Lifetime cash flow",
      caption: "All recorded transactions since setup.",
      comparisonLabel: "before this year",
      overviewLabel: "All lifetime",
    };
  }

  const currentStart =
    period === "week" ? startOfWeek(now) : period === "month" ? startOfMonth(now) : startOfYear(now);
  const currentEnd =
    period === "week"
      ? shiftDate(currentStart, "week", 1)
      : period === "month"
        ? shiftDate(currentStart, "month", 1)
        : shiftDate(currentStart, "year", 1);
  const previousStart =
    period === "week"
      ? shiftDate(currentStart, "week", -1)
      : period === "month"
        ? shiftDate(currentStart, "month", -1)
        : shiftDate(currentStart, "year", -1);

  return {
    current: filterTransactionsByRange(transactions, currentStart, currentEnd),
    previous: filterTransactionsByRange(transactions, previousStart, currentStart),
    currentStart,
    title:
      period === "week"
        ? "This week's cash flow"
        : period === "month"
          ? "This month's cash flow"
          : "This year's cash flow",
    caption:
      period === "week"
        ? "Transactions dated in the current calendar week."
        : period === "month"
          ? "Transactions dated in the current calendar month."
          : "Transactions dated in the current calendar year.",
    comparisonLabel:
      period === "week" ? "last week" : period === "month" ? "last month" : "last year",
    overviewLabel: getPeriodOverviewLabel(period, now),
  };
}

export function getAggregateBalanceAtDate(
  accounts: Account[],
  transactions: Transaction[],
  boundary: Date | null,
) {
  const openingBalance = getAggregateOpeningBalance(accounts);
  if (!boundary) return openingBalance;

  const priorMovement = transactions.reduce((sum, transaction) => {
    const occurredOn = new Date(`${transaction.occurredOn}T00:00:00`);
    if (occurredOn >= boundary) return sum;
    return sum + getTransactionBalanceDelta(transaction);
  }, 0);

  return openingBalance + priorMovement;
}
