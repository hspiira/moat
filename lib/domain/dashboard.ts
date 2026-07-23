import { getAggregateOpeningBalance, getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { Account, Category, Transaction } from "@/lib/types";

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

export type DashboardChartPoint = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  saved: number;
  savingsRate: number;
};

type PeriodConfig = {
  chartLabel: string;
  overviewLabel: (now: Date) => string;
  title: string;
  caption: string;
  comparisonLabel: string | null;
  formatChartPoint: (date: Date) => string;
};

const PERIOD_CONFIG: Record<PeriodFilter, PeriodConfig> = {
  week: {
    chartLabel: "Week",
    overviewLabel: () => "This week",
    title: "This week's cash flow",
    caption: "Transactions dated in the current calendar week.",
    comparisonLabel: "last week",
    formatChartPoint: (date) =>
      new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short" }).format(date),
  },
  month: {
    chartLabel: "Month",
    overviewLabel: (now) =>
      new Intl.DateTimeFormat("en-UG", { month: "long", year: "numeric" }).format(now),
    title: "This month's cash flow",
    caption: "Transactions dated in the current calendar month.",
    comparisonLabel: "last month",
    formatChartPoint: (date) =>
      new Intl.DateTimeFormat("en-UG", { month: "short" }).format(date),
  },
  year: {
    chartLabel: "Year",
    overviewLabel: (now) => now.getFullYear().toString(),
    title: "This year's cash flow",
    caption: "Transactions dated in the current calendar year.",
    comparisonLabel: "last year",
    formatChartPoint: (date) => String(date.getFullYear()),
  },
  all: {
    chartLabel: "Lifetime",
    overviewLabel: () => "All lifetime",
    title: "Lifetime cash flow",
    caption: "All recorded transactions since setup.",
    comparisonLabel: "before this year",
    // Chart series never renders in "all" mode (buildDashboardChartSeries
    // maps it to "year" first), so this formatter is unreachable in practice.
    formatChartPoint: (date) => String(date.getFullYear()),
  },
};

export function getPeriodOverviewLabel(period: PeriodFilter, now: Date) {
  return PERIOD_CONFIG[period].overviewLabel(now);
}

export function getPeriodChartLabel(period: PeriodFilter) {
  return PERIOD_CONFIG[period].chartLabel;
}

export function getChangePercent(current: number, previous: number): ChangeMetric {
  if (previous === 0 && current === 0) return { kind: "none", value: null };
  if (previous === 0) return { kind: "new", value: null };

  return {
    kind: "delta",
    // Divide by |previous| so the sign always follows the direction of the
    // change; dividing by a negative baseline would flip it (e.g. saved going
    // from -300k to -1.1M must read as a decrease, not +279%).
    value: ((current - previous) / Math.abs(previous)) * 100,
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
  const config = PERIOD_CONFIG[period];

  if (period === "all") {
    const yearStart = startOfYear(now);

    return {
      current: transactions,
      previous: filterTransactionsByRange(transactions, new Date(0), yearStart),
      currentStart: null,
      title: config.title,
      caption: config.caption,
      comparisonLabel: config.comparisonLabel,
      overviewLabel: config.overviewLabel(now),
    };
  }

  const currentStart =
    period === "week" ? startOfWeek(now) : period === "month" ? startOfMonth(now) : startOfYear(now);
  const currentEnd = shiftDate(currentStart, period, 1);
  const previousStart = shiftDate(currentStart, period, -1);

  return {
    current: filterTransactionsByRange(transactions, currentStart, currentEnd),
    previous: filterTransactionsByRange(transactions, previousStart, currentStart),
    currentStart,
    title: config.title,
    caption: config.caption,
    comparisonLabel: config.comparisonLabel,
    overviewLabel: config.overviewLabel(now),
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

function formatChartLabel(date: Date, period: PeriodFilter) {
  return PERIOD_CONFIG[period].formatChartPoint(date);
}

export function buildDashboardChartSeries(
  transactions: Transaction[],
  categories: Category[],
  period: PeriodFilter,
  now: Date,
): DashboardChartPoint[] {
  const effectivePeriod: Exclude<PeriodFilter, "all"> = period === "all" ? "year" : period;
  const bucketCount = 6;
  const currentStart =
    effectivePeriod === "week"
      ? startOfWeek(now)
      : effectivePeriod === "month"
        ? startOfMonth(now)
        : startOfYear(now);

  return Array.from({ length: bucketCount }, (_, index) => {
    const offset = index - (bucketCount - 1);
    const start = shiftDate(currentStart, effectivePeriod, offset);
    const end = shiftDate(start, effectivePeriod, 1);
    const bucketTransactions = filterTransactionsByRange(transactions, start, end);
    const summary = getSummaryForTransactions(bucketTransactions, categories);

    return {
      key: `${effectivePeriod}-${start.toISOString()}`,
      label: formatChartLabel(start, effectivePeriod),
      inflow: summary.inflow,
      outflow: summary.outflow,
      saved: summary.savings,
      savingsRate: getSavingsRate(summary),
    };
  });
}
