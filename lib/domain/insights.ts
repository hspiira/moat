import { FEES_CATEGORY_NAME } from "@/lib/app-state/defaults";
import { formatMoney } from "@/lib/currency";
import { getFeeLoad } from "@/lib/domain/fees";
import { detectBalanceGapsByAccount } from "@/lib/domain/balance-gap";
import { getLendingPortfolio } from "@/lib/domain/lending";
import { projectSpendForCategory } from "@/lib/domain/projects";
import { getGoalPace } from "@/lib/domain/goal-pace";
import { getIncomeStability } from "@/lib/domain/income-stability";
import { findPriceRises } from "@/lib/domain/price-observations";
import { getRunway } from "@/lib/domain/runway";
import { detectRecurringCandidates } from "@/lib/domain/recurring-detection";
import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type {
  Account,
  Category,
  Counterparty,
  Goal,
  Item,
  TransactionLineItem,
  MonthSummary,
  Project,
  Transaction,
} from "@/lib/types";

const MAX_INSIGHTS = 4;
const MIN_REPEATS_FOR_UNIT_COST = 5;
const CONCENTRATION_FLOOR = 0.4;
const MOVEMENT_FLOOR = 0.25;
const MATERIAL_AMOUNT = 20_000;
const MIN_FEE_TOTAL = 1_000;
const MIN_BALANCE_GAP = 1_000;
const MIN_PRICE_RISE = 500;
const RUNWAY_HORIZON_DAYS = 45;
const URGENT_RUNWAY_DAYS = 14;
const INCOME_SWING_FLOOR = 0.4;

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
  // Everything ever recorded. Outstanding lending and a running balance are
  // cumulative, so a rule about either cannot read only the period.
  allTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  projects: Project[];
  counterparties: Counterparty[];
  trackedPayees: string[];
  goals: Goal[];
  items: Item[];
  lineItems: TransactionLineItem[];
  today: string;
  now: Date;
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

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
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
    href: `/transactions?q=${encodeURIComponent(FEES_CATEGORY_NAME)}`,
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
  projects,
  periodLabel,
}) => {
  const current = totalsByCategory(transactions, categories);
  const before = totalsByCategory(previousTransactions, categories);

  let biggest:
    | { categoryId: string; name: string; now: number; then: number; change: number }
    | null = null;

  for (const [categoryId, total] of current) {
    const then = before.get(categoryId)?.amount ?? 0;
    if (then <= 0 || total.amount < MATERIAL_AMOUNT) continue;

    const change = (total.amount - then) / then;
    if (Math.abs(change) < MOVEMENT_FLOOR) continue;
    if (!biggest || Math.abs(change) > Math.abs(biggest.change)) {
      biggest = { categoryId, name: total.name, now: total.amount, then, change };
    }
  }

  if (!biggest) return null;

  const direction = biggest.change > 0 ? "up" : "down";
  // A spike with a project behind it is a plan, not a problem. Say which.
  const tagged = projectSpendForCategory(transactions, biggest.categoryId, projects);
  const explanation = tagged
    ? ` ${formatMoney(tagged.amount)} of it is tagged ${tagged.project.name}.`
    : "";

  return {
    id: "insight:movement",
    title: `${biggest.name} is ${direction} ${percent(Math.abs(biggest.change))}`,
    body: `${formatMoney(biggest.now)} ${periodPhrase(periodLabel)} against ${formatMoney(biggest.then)} ${previousPhrase(periodLabel)}.${explanation}`,
    href: tagged ? "/projects" : "/report",
    priority: tagged ? 3 : biggest.change > 0 ? 1 : 3,
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
    href: `/accounts/detail?id=${encodeURIComponent(worst.id)}`,
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

const idleLendingRule: InsightRule = ({
  allTransactions,
  accounts,
  counterparties,
  now,
}) => {
  const portfolio = getLendingPortfolio(accounts, allTransactions, now, counterparties);
  const waiting = portfolio.parties.filter(
    (party) => party.status === "outstanding" && party.outstanding >= MATERIAL_AMOUNT,
  );
  if (waiting.length === 0) return null;

  // Overdue first, then whoever has been quiet longest.
  const worst = [...waiting].sort((left, right) => {
    if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
    return right.daysSinceLastActivity - left.daysSinceLastActivity;
  })[0];

  const quiet =
    worst.daysSinceLastActivity > 0
      ? `Nothing has moved on it in ${worst.daysSinceLastActivity} days.`
      : "It moved today.";
  const due = worst.isOverdue
    ? ` It was due on ${worst.expectedRepaymentDate}.`
    : "";

  return {
    id: "insight:idle-lending",
    title: `${worst.partyName} still owes you ${formatMoney(worst.outstanding)}`,
    body: `${quiet}${due}`,
    href: "/debt",
    priority: worst.isOverdue ? 1 : 2,
  };
};

const balanceGapRule: InsightRule = ({ allTransactions, accounts }) => {
  const gaps = detectBalanceGapsByAccount(allTransactions).filter(
    (gap) => Math.abs(gap.gap) >= MIN_BALANCE_GAP,
  );
  if (gaps.length === 0) return null;

  const worst = gaps.reduce((held, gap) =>
    Math.abs(gap.gap) > Math.abs(held.gap) ? gap : held,
  );
  const account = accounts.find((entry) => entry.id === worst.accountId);

  return {
    id: "insight:balance-gap",
    title: `${account?.name ?? "An account"} is ${formatMoney(Math.abs(worst.gap))} out of step`,
    body: `The last message on it stated ${formatMoney(worst.statedBalance)}, but the entries add up to ${formatMoney(worst.expectedBalance)}. Something is missing or counted twice.`,
    href: account ? `/accounts/detail?id=${encodeURIComponent(account.id)}` : "/accounts",
    priority: 1,
  };
};

const untrackedBillRule: InsightRule = ({ allTransactions, trackedPayees, now }) => {
  const [candidate] = detectRecurringCandidates({
    transactions: allTransactions,
    trackedPayees,
    now,
  });
  if (!candidate) return null;

  return {
    id: "insight:untracked-bill",
    title: `${candidate.name} looks monthly at ${formatMoney(candidate.typicalAmount)}`,
    body: `Seen in ${candidate.monthsSeen} months, usually around the ${candidate.typicalDay}${ordinal(candidate.typicalDay)}, and not tracked as a bill. Tracking it means it can be counted before it lands rather than after.`,
    href: "/recurring",
    priority: 2,
  };
};

const priceRiseRule: InsightRule = ({ items, lineItems, allTransactions, today }) => {
  const [rise] = findPriceRises({ items, lineItems, transactions: allTransactions, today });
  if (!rise || rise.rise < MIN_PRICE_RISE) return null;

  return {
    id: "insight:price-rise",
    title: `${rise.name} costs ${formatMoney(rise.rise)} more than it has`,
    body: `${formatMoney(rise.paidNow)} at ${rise.now.merchant} on ${rise.now.occurredOn}, against ${formatMoney(rise.paidBefore)} at ${rise.before.merchant} on ${rise.before.occurredOn}.`,
    href: "/shopping",
    priority: 3,
  };
};

const runwayRule: InsightRule = ({ allTransactions, accounts, now }) => {
  const runway = getRunway({ accounts, transactions: allTransactions, now });
  if (runway.daysCovered === null || runway.daysCovered > RUNWAY_HORIZON_DAYS) return null;

  const days = runway.daysCovered;
  const when =
    days === 0
      ? "There is nothing spendable left"
      : days === 1
        ? "That is one more day"
        : `That is about ${days} more days`;

  return {
    id: "insight:runway",
    title: `${formatMoney(runway.liquid)} spendable, going out at ${formatMoney(runway.dailyBurn)} a day`,
    body: `${when}, on the last ${runway.daysMeasured} days of spending. At this rate it is gone by ${runway.runsOutOn}, before counting anything still to come in.`,
    href: "/report",
    priority: days <= URGENT_RUNWAY_DAYS ? 1 : 2,
  };
};

const incomeSwingRule: InsightRule = ({ allTransactions, now }) => {
  const stability = getIncomeStability({ transactions: allTransactions, now });
  if (!stability || stability.swing < INCOME_SWING_FLOOR) return null;

  return {
    id: "insight:income-swing",
    title: `Income ranged ${formatMoney(stability.lowest.total)} to ${formatMoney(stability.highest.total)}`,
    body: `Across ${stability.months.length} months, with a middle month of ${formatMoney(stability.median)}. A plan built on ${formatMoney(stability.lowest.total)} holds in a month like ${stability.lowest.month}; one built on the average does not.`,
    href: "/budgets",
    priority: 2,
  };
};

const goalPaceRule: InsightRule = ({ goals, allTransactions, categories, now }) => {
  const [behind] = getGoalPace({ goals, transactions: allTransactions, categories, now })
    .filter((pace) => pace.shortfall > 0);
  if (!behind) return null;

  const nothingYet = behind.contributedThisMonth === 0;

  return {
    id: "insight:goal-pace",
    title: `${behind.goal.name} needs ${formatMoney(behind.requiredMonthly)} a month`,
    body: nothingYet
      ? `Nothing has gone in this month, with ${behind.monthsRemaining} ${behind.monthsRemaining === 1 ? "month" : "months"} left to reach ${formatMoney(behind.goal.targetAmount)}. A month skipped raises every month after it.`
      : `${formatMoney(behind.contributedThisMonth)} has gone in, leaving ${formatMoney(behind.shortfall)} to keep pace this month.`,
    href: "/goals",
    priority: nothingYet ? 2 : 3,
  };
};

const INSIGHT_RULES: InsightRule[] = [
  runwayRule,
  balanceGapRule,
  feeLoadRule,
  incomeSwingRule,
  goalPaceRule,
  untrackedBillRule,
  priceRiseRule,
  idleLendingRule,
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
