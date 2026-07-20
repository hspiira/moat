"use client";

import { DashboardBalanceBridge } from "@/components/dashboard/dashboard-balance-bridge";
import { DashboardBudgetCoverage } from "@/components/dashboard/dashboard-budget-coverage";
import { DashboardMoatHero } from "@/components/dashboard/dashboard-moat-hero";
import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import {
  DashboardAccountBalances,
  DashboardCashFlowSection,
  DashboardContinueLinks,
  DashboardInsightsPanel,
  DashboardQuickActions,
  DashboardTopSpendingCategories,
} from "@/components/dashboard/dashboard-sections";
import { useDashboardWorkspace } from "@/components/dashboard/use-dashboard-workspace";
import { ErrorStateCard } from "@/components/page-shell/page-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProfile } from "@/lib/types";

type DashboardWorkspaceProps = {
  profile: UserProfile;
};

function DashboardSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only" role="status">
        Loading your overview…
      </span>
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardWorkspace({ profile }: DashboardWorkspaceProps) {
  const {
    period,
    setPeriod,
    isLoading,
    error,
    periodWindow,
    summary,
    savingsRate,
    insights,
    chartLabel,
    chartSeries,
    budgetCoverage,
    budgetEnvelopes,
    topAccounts,
    summaryTiles,
    budgets,
    transactions,
    accounts,
    modulePreviews,
  } = useDashboardWorkspace(profile);

  const quickActions = [
    { href: "/transactions/capture", title: "Add transaction" },
    { href: "/accounts", title: "Accounts" },
    { href: "/goals", title: "Set goal" },
  ];

  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const totalBalance = activeAccounts.reduce((sum, account) => sum + account.balance, 0);
  // Use the first name only so the heading and filter always share one row.
  const firstName = profile.displayName.trim().split(/\s+/)[0] || profile.displayName;

  return (
    <div className="grid gap-5">
      <header className="space-y-1">
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {periodWindow.title}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {firstName}&apos;s money
          </h1>
          <div className="shrink-0">
            <DashboardPeriodFilter period={period} onChange={setPeriod} />
          </div>
        </div>
      </header>

      {error ? <ErrorStateCard message={error} /> : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <DashboardMoatHero
            totalBalance={totalBalance}
            accountCount={activeAccounts.length}
            monthlyOutflow={summary.outflow}
            inflow={summary.inflow}
            outflow={summary.outflow}
            net={summary.net}
            periodLabel={periodWindow.caption}
          />

          <DashboardQuickActions actions={quickActions} />

          <DashboardCashFlowSection
            summaryTiles={summaryTiles}
            savingsRate={savingsRate}
            allocatedSavings={summary.allocatedSavings}
            chartLabel={chartLabel}
            chartSeries={chartSeries}
          />

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <DashboardTopSpendingCategories categories={summary.topCategories} />

            <div className="grid content-start gap-5">
              <DashboardAccountBalances accounts={topAccounts} transactions={transactions} />

              <DashboardBudgetCoverage
                hasBudgets={budgets.length > 0}
                allocated={budgetCoverage.allocated}
                spent={budgetCoverage.spent}
                remaining={budgetCoverage.remaining}
                envelopes={budgetEnvelopes}
              />

              <DashboardBalanceBridge
                openingBalance={summary.openingBalance}
                inflow={summary.inflow}
                outflow={summary.outflow}
                allocatedSavings={summary.allocatedSavings}
                movement={summary.movement}
                closingBalance={summary.closingBalance}
              />

              <DashboardInsightsPanel insights={insights} />
            </div>
          </div>

          <div className="hidden lg:block">
            <DashboardContinueLinks modules={modulePreviews} />
          </div>
        </>
      )}
    </div>
  );
}
