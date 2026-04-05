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

  if (summary.allocatedSavings === 0 && summary.savings > 0) {
    insights.push(
      buildInsight(
        "insight:no-savings",
        "No savings allocation recorded",
        `You still saved money ${periodPhrase}, but none of it was explicitly tagged as a savings contribution. Record where that surplus is meant to sit so the plan stays intentional.`,
        2,
        periodLabel,
      ),
    );
  }

  if (summary.allocatedSavings > summary.savings && summary.savings >= 0) {
    insights.push(
      buildInsight(
        "insight:over-allocated-savings",
        "Savings allocations exceed the period surplus",
        `Tagged savings contributions are higher than the surplus recorded ${periodPhrase}. Check whether those contributions were funded from prior balances or whether some spending or income entries are missing.`,
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
