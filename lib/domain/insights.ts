import type { Account, MonthlyInsight, MonthSummary, Transaction } from "@/lib/types";

function buildInsight(
  id: string,
  title: string,
  body: string,
  priority: MonthlyInsight["priority"],
  month: string,
): Omit<MonthlyInsight, "userId"> {
  return { id, title, body, priority, month };
}

export function getMonthlyInsights(
  summary: MonthSummary,
  transactions: Transaction[],
  accounts: Account[],
  periodLabel: string,
): Omit<MonthlyInsight, "userId">[] {
  const insights: Omit<MonthlyInsight, "userId">[] = [];
  const periodPhrase =
    periodLabel === "week"
      ? "this week"
      : periodLabel === "year"
        ? "this year"
        : periodLabel === "all"
          ? "across all recorded history"
          : "this month";
  const transferPhrase =
    periodLabel === "all" ? "across all recorded history" : `in ${periodPhrase}`;

  if (summary.outflow > summary.inflow && summary.inflow > 0) {
    insights.push(
      buildInsight(
        "insight:deficit",
        "Outflow exceeded inflow",
        `${periodPhrase.charAt(0).toUpperCase() + periodPhrase.slice(1)} closed in deficit. Review the largest expense categories before adding new savings or investment commitments.`,
        1,
        periodLabel,
      ),
    );
  }

  if (summary.savings === 0 && summary.inflow > 0) {
    insights.push(
      buildInsight(
        "insight:no-savings",
        "No savings contributions recorded",
        `Income was recorded ${periodPhrase} but nothing was tagged as savings. Set aside an explicit savings contribution to avoid silent drift.`,
        2,
        periodLabel,
      ),
    );
  }

  const topCategory = summary.topCategories[0];
  if (topCategory) {
    insights.push(
      buildInsight(
        "insight:top-category",
        `Largest spend: ${topCategory.categoryName}`,
        `${topCategory.categoryName} is the biggest spending category ${periodPhrase}. Confirm whether this level of spend is intentional or leaking from routine habits.`,
        2,
        periodLabel,
      ),
    );
  }

  const transferCount = transactions.filter((transaction) => transaction.type === "transfer").length;
  if (transferCount >= 4) {
    insights.push(
      buildInsight(
        "insight:transfers",
        "Heavy transfer activity detected",
        `Frequent transfers between accounts ${transferPhrase} can hide where money is actually being used. Double-check that cash movement still matches your intended spending plan.`,
        3,
        periodLabel,
      ),
    );
  }

  const lowCashAccounts = accounts.filter(
    (account) => !account.isArchived && account.type !== "debt" && account.balance < 0,
  );
  if (lowCashAccounts.length > 0) {
    insights.push(
      buildInsight(
        "insight:negative-balance",
        "One or more accounts are below zero",
        "At least one tracked account has a negative balance after reconciliation. Verify recent entries and decide whether this is debt, overdraft, or a tracking error.",
        1,
        periodLabel,
      ),
    );
  }

  return insights.slice(0, 4);
}
