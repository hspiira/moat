import { formatMoney } from "@/lib/currency";
import { getFeeLoad } from "@/lib/domain/fees";
import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type { Account, Category, MonthSummary, Transaction } from "@/lib/types";

const MAX_INSIGHTS = 4;
const MIN_REPEATS_FOR_UNIT_COST = 5;
const CONCENTRATION_FLOOR = 0.4;
const MOVEMENT_FLOOR = 0.25;
const MATERIAL_AMOUNT = 20_000;
const MIN_FEE_TOTAL = 1_000;

export type Insight = {
  id: string;
  title: string;
  body: string;
  href?: string;
  priority: 1 | 2 | 3;
};

export type InsightContext = {
  summary: MonthSummary;
  transactions: Transaction[];
  previousTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  periodLabel: string;
};

type InsightRule = (context: InsightContext) => Insight | null;

function periodPhrase(periodLabel: string): string {
  if (periodLabel === "week") return "this week";
  if (periodLabel === "year") return "this year";
  if (periodLabel === "all") return "across everything recorded";
  return "this month";
}

function previousPhrase(periodLabel: string): string {
  if (periodLabel === "week") return "last week";
  if (periodLabel === "year") return "last year";
  return "last month";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type CategoryTotal = { name: string; amount: number; count: number };

function totalsByCategory(
  transactions: Transaction[],
  categories: Category[],
): Map<string, CategoryTotal> {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, CategoryTotal>();

  for (const transaction of transactions) {
    if (isTransferTransaction(transaction) || !isSpendingTransaction(transaction)) continue;

    const held = totals.get(transaction.categoryId);
    totals.set(transaction.categoryId, {
      name: held?.name ?? names.get(transaction.categoryId) ?? "Uncategorized",
      amount: (held?.amount ?? 0) + Math.abs(transaction.amount),
      count: (held?.count ?? 0) + 1,
    });
  }

  return totals;
}

const feeLoadRule: InsightRule = ({ transactions, periodLabel }) => {
  const load = getFeeLoad(transactions);
  if (load.fees < MIN_FEE_TOTAL) return null;

  const share = load.share > 0 ? ` — ${percent(load.share)} of the ${formatMoney(load.movedOut)} you moved` : "";

  return {
    id: "insight:fees",
    title: `Charges cost you ${formatMoney(load.fees)} ${periodPhrase(periodLabel)}`,
    body: `${load.count} ${load.count === 1 ? "charge" : "charges"}${share}. Fewer, larger transfers cost less than many small ones.`,
    href: "/report",
    priority: 1,
  };
};

const unitCostRule: InsightRule = ({
  transactions,
  previousTransactions,
  categories,
  periodLabel,
}) => {
  const current = [...totalsByCategory(transactions, categories).entries()]
    .filter(([, total]) => total.count >= MIN_REPEATS_FOR_UNIT_COST)
    .sort(([, left], [, right]) => right.amount - left.amount)[0];
  if (!current) return null;

  const [categoryId, total] = current;
  const unit = Math.round(total.amount / total.count);
  const before = totalsByCategory(previousTransactions, categories).get(categoryId);
  const beforeUnit = before && before.count > 0 ? Math.round(before.amount / before.count) : null;

  const comparison =
    beforeUnit === null
      ? `No figure for ${previousPhrase(periodLabel)} to compare against.`
      : beforeUnit === unit
        ? `Same as ${previousPhrase(periodLabel)}.`
        : `${formatMoney(beforeUnit)} each ${previousPhrase(periodLabel)}.`;

  return {
    id: "insight:unit-cost",
    title: `${total.name} costs ${formatMoney(unit)} each time`,
    body: `${formatMoney(total.amount)} across ${total.count} times ${periodPhrase(periodLabel)}. ${comparison}`,
    href: "/report",
    priority: 2,
  };
};

const concentrationRule: InsightRule = ({ summary, periodLabel }) => {
  const top = summary.topCategories[0];
  if (!top || summary.outflow <= 0) return null;

  const share = top.amount / summary.outflow;
  if (share < CONCENTRATION_FLOOR) return null;

  return {
    id: "insight:concentration",
    title: `${top.categoryName} is ${percent(share)} of your spending`,
    body: `${formatMoney(top.amount)} of the ${formatMoney(summary.outflow)} you spent ${periodPhrase(periodLabel)}. Everything else competes for what is left.`,
    href: "/budgets",
    priority: 2,
  };
};

const movementRule: InsightRule = ({
  transactions,
  previousTransactions,
  categories,
  periodLabel,
}) => {
  const current = totalsByCategory(transactions, categories);
  const before = totalsByCategory(previousTransactions, categories);

  let biggest: { name: string; now: number; then: number; change: number } | null = null;

  for (const [categoryId, total] of current) {
    const then = before.get(categoryId)?.amount ?? 0;
    if (then <= 0 || total.amount < MATERIAL_AMOUNT) continue;

    const change = (total.amount - then) / then;
    if (Math.abs(change) < MOVEMENT_FLOOR) continue;
    if (!biggest || Math.abs(change) > Math.abs(biggest.change)) {
      biggest = { name: total.name, now: total.amount, then, change };
    }
  }

  if (!biggest) return null;

  const direction = biggest.change > 0 ? "up" : "down";

  return {
    id: "insight:movement",
    title: `${biggest.name} is ${direction} ${percent(Math.abs(biggest.change))}`,
    body: `${formatMoney(biggest.now)} ${periodPhrase(periodLabel)} against ${formatMoney(biggest.then)} ${previousPhrase(periodLabel)}.`,
    href: "/report",
    priority: biggest.change > 0 ? 1 : 3,
  };
};

const deficitRule: InsightRule = ({ summary, periodLabel }) => {
  if (!(summary.outflow > summary.inflow && summary.inflow > 0)) return null;

  return {
    id: "insight:deficit",
    title: `You spent ${formatMoney(summary.outflow - summary.inflow)} more than you earned`,
    body: `${formatMoney(summary.outflow)} out against ${formatMoney(summary.inflow)} in ${periodPhrase(periodLabel)}. The difference came out of what you already had.`,
    href: "/report",
    priority: 1,
  };
};

const negativeBalanceRule: InsightRule = ({ accounts }) => {
  const below = accounts.filter(
    (account) => !account.isArchived && account.type !== "debt" && account.balance < 0,
  );
  if (below.length === 0) return null;

  const worst = [...below].sort((left, right) => left.balance - right.balance)[0];
  const others =
    below.length > 1 ? ` and ${below.length - 1} other ${below.length === 2 ? "account" : "accounts"}` : "";

  return {
    id: "insight:negative-balance",
    title: `${worst.name} is ${formatMoney(Math.abs(worst.balance))} below zero`,
    body: `${worst.name}${others} shows a negative balance after reconciliation. Either an entry is missing or this is borrowing that should be recorded as debt.`,
    href: "/accounts",
    priority: 1,
  };
};

const untaggedSurplusRule: InsightRule = ({ summary, periodLabel }) => {
  if (!(summary.allocatedSavings === 0 && summary.savings > 0)) return null;

  return {
    id: "insight:no-savings",
    title: `${formatMoney(summary.savings)} was left over and none of it was set aside`,
    body: `You kept money ${periodPhrase(periodLabel)} but none of it moved into savings, so it is still sitting where it can be spent.`,
    href: "/goals",
    priority: 2,
  };
};

const INSIGHT_RULES: InsightRule[] = [
  feeLoadRule,
  deficitRule,
  negativeBalanceRule,
  movementRule,
  concentrationRule,
  unitCostRule,
  untaggedSurplusRule,
];

export function getMonthlyInsights(context: InsightContext): Insight[] {
  return INSIGHT_RULES.map((rule) => rule(context))
    .filter((insight): insight is Insight => insight !== null)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, MAX_INSIGHTS);
}

export const insightRuleCount = INSIGHT_RULES.length;
