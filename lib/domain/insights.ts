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
  month: string,
): Omit<MonthlyInsight, "userId">[] {
  const insights: Omit<MonthlyInsight, "userId">[] = [];

  if (summary.outflow > summary.inflow && summary.inflow > 0) {
    insights.push(
      buildInsight(
        "insight:deficit",
        "Outflow exceeded inflow",
        "This month closed in deficit. Review the largest expense categories before adding new savings or investment commitments.",
        1,
        month,
      ),
    );
  }

  if (summary.savings === 0 && summary.inflow > 0) {
    insights.push(
      buildInsight(
        "insight:no-savings",
        "No savings contributions recorded",
        "Income was recorded this month but nothing was tagged as savings. Set aside an explicit savings contribution to avoid silent drift.",
        2,
        month,
      ),
    );
  }

  const topCategory = summary.topCategories[0];
  if (topCategory) {
    insights.push(
      buildInsight(
        "insight:top-category",
        `Largest spend: ${topCategory.categoryName}`,
        `${topCategory.categoryName} is the biggest spending category this month. Confirm whether this level of spend is intentional or leaking from routine habits.`,
        2,
        month,
      ),
    );
  }

  const transferCount = transactions.filter((transaction) => transaction.type === "transfer").length;
  if (transferCount >= 4) {
    insights.push(
      buildInsight(
        "insight:transfers",
        "Heavy transfer activity detected",
        "Frequent transfers between accounts can hide where money is actually being used. Double-check that cash movement still matches your intended spending plan.",
        3,
        month,
      ),
    );
  }

  const lowCashAccounts = accounts.filter(
    (account) => !account.isArchived && account.balance < 0,
  );
  if (lowCashAccounts.length > 0) {
    insights.push(
      buildInsight(
        "insight:negative-balance",
        "One or more accounts are below zero",
        "At least one tracked account has a negative balance after reconciliation. Verify recent entries and decide whether this is debt, overdraft, or a tracking error.",
        1,
        month,
      ),
    );
  }

  return insights.slice(0, 4);
}
