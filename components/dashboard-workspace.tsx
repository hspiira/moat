"use client";

import { DashboardBalanceBridge } from "@/components/dashboard/dashboard-balance-bridge";
import { DashboardBudgetCoverage } from "@/components/dashboard/dashboard-budget-coverage";
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
import { Card, CardContent } from "@/components/ui/card";
import type { UserProfile } from "@/lib/types";

type DashboardWorkspaceProps = {
  profile: UserProfile;
};

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
    budgetCoverage,
    budgetEnvelopes,
    topAccounts,
    summaryTiles,
    budgets,
    transactions,
    modulePreviews,
  } = useDashboardWorkspace(profile);

  const quickActions = [
    { href: "/transactions", title: "Add transaction" },
    { href: "/accounts", title: "Accounts" },
    { href: "/goals", title: "Set goal" },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.displayName}&apos;s overview
          </h1>
          <p className="text-sm text-muted-foreground">{periodWindow.overviewLabel}</p>
        </div>
        <DashboardPeriodFilter period={period} onChange={setPeriod} />
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading dashboard...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <>
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">{periodWindow.title}</h2>
            <p className="text-xs text-muted-foreground">{periodWindow.caption}</p>
          </div>

          <DashboardQuickActions actions={quickActions} />

          <DashboardCashFlowSection
            summaryTiles={summaryTiles}
            savingsRate={savingsRate}
            allocatedSavings={summary.allocatedSavings}
            chartLabel={chartLabel}
          />

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <DashboardTopSpendingCategories categories={summary.topCategories} />

            <div className="grid gap-5 content-start">
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
      ) : null}
    </div>
  );
}
