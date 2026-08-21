"use client";

import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

import { DashboardBalanceBridge } from "@/components/dashboard/dashboard-balance-bridge";
import { DashboardMoatHero } from "@/components/dashboard/dashboard-moat-hero";
import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import {
  DashboardAttentionPanel,
  DashboardCashFlowSection,
  DashboardTopSpendingCategories,
} from "@/components/dashboard/dashboard-sections";
import { useDashboardWorkspace } from "@/components/dashboard/use-dashboard-workspace";
import { useRecordTransaction } from "@/components/transactions/record-transaction-sheet";
import { ErrorStateCard } from "@/components/page-shell/page-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountTotals } from "@/lib/domain/accounts";
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
    attentionItems,
    chartLabel,
    chartSeries,
    accounts,
    inflowChange,
    outflowChange,
  } = useDashboardWorkspace(profile);

  const record = useRecordTransaction();

  const { totalBalance, activeAccounts: activeAccountCount } = getAccountTotals(accounts);
  const firstName = profile.displayName.trim().split(/\s+/)[0] || profile.displayName;

  return (
    <div className="grid gap-5">
      <header className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
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
            accountCount={activeAccountCount}
            monthlyOutflow={summary.outflow}
            inflow={summary.inflow}
            outflow={summary.outflow}
            net={summary.net}
            periodLabel={periodWindow.caption}
            inflowChange={inflowChange}
            outflowChange={outflowChange}
          />

          <DashboardAttentionPanel items={attentionItems} />

          <DashboardCashFlowSection
            savingsRate={savingsRate}
            hasIncome={summary.inflow > 0}
            allocatedSavings={summary.allocatedSavings}
            chartLabel={chartLabel}
            chartSeries={chartSeries}
          />

          <Link
            href="/report"
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            See how your money has moved
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>

          <DashboardBalanceBridge
            openingBalance={summary.openingBalance}
            inflow={summary.inflow}
            outflow={summary.outflow}
            allocatedSavings={summary.allocatedSavings}
            movement={summary.movement}
            closingBalance={summary.closingBalance}
          />

          <DashboardTopSpendingCategories
            categories={summary.topCategories}
            totalOutflow={summary.outflow}
            onAddTransaction={record.open}
          />
        </>
      )}

      {record.sheet}
    </div>
  );
}
