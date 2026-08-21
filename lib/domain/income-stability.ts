import { currentMonthIso } from "@/lib/today";
import type { Transaction } from "@/lib/types";

export type IncomeMonth = { month: string; total: number };

export type IncomeStability = {
  months: IncomeMonth[];
  lowest: IncomeMonth;
  highest: IncomeMonth;
  median: number;
  // How far apart the best and worst months are, against the middle month.
  swing: number;
};

const DEFAULT_MONTHS_BACK = 6;
const MIN_MONTHS = 3;

function previousMonths(from: string, count: number): string[] {
  const [year, month] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const offset = month - 1 - (index + 1);
    const targetYear = year + Math.floor(offset / 12);
    const targetMonth = ((offset % 12) + 12) % 12;
    return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
  }).reverse();
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

// Irregular income is the normal case here, and an average hides it. What a
// budget needs is the worst month, not the typical one.
//
// The month in progress is excluded: it is incomplete, so counting it would
// always drag the low end down and make every month look like a bad one.
export function getIncomeStability(params: {
  transactions: Transaction[];
  now: Date;
  monthsBack?: number;
}): IncomeStability | null {
  const monthsBack = params.monthsBack ?? DEFAULT_MONTHS_BACK;
  const wanted = previousMonths(currentMonthIso(params.now), monthsBack);

  const totals = new Map<string, number>(wanted.map((month) => [month, 0]));
  for (const transaction of params.transactions) {
    if (transaction.type !== "income") continue;
    const month = transaction.occurredOn.slice(0, 7);
    if (!totals.has(month)) continue;
    totals.set(month, (totals.get(month) ?? 0) + Math.abs(transaction.amount));
  }

  const months = wanted
    .map((month) => ({ month, total: totals.get(month) ?? 0 }))
    .filter((entry) => entry.total > 0);

  if (months.length < MIN_MONTHS) return null;

  const amounts = months.map((entry) => entry.total);
  const lowest = months.reduce((held, entry) => (entry.total < held.total ? entry : held));
  const highest = months.reduce((held, entry) => (entry.total > held.total ? entry : held));
  const middle = median(amounts);

  return {
    months,
    lowest,
    highest,
    median: middle,
    swing: middle > 0 ? (highest.total - lowest.total) / middle : 0,
  };
}
