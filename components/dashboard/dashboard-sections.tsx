"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";

import { AmountIndicator } from "@/components/amount-indicator";
import { AccountBalanceBreakdown } from "@/components/accounts/account-balance-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Account, Transaction } from "@/lib/types";
import type { SummaryTile } from "@/components/dashboard/dashboard-summary-tiles";
import { DashboardSummaryTiles } from "@/components/dashboard/dashboard-summary-tiles";
import type { DashboardChartPoint } from "@/lib/domain/dashboard";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type ChartMode = "rate" | "flow" | "allocation";

const CHART_MODES: { value: ChartMode; label: string }[] = [
  { value: "rate", label: "Rate" },
  { value: "flow", label: "Flow" },
  { value: "allocation", label: "Alloc" },
];

const CHART_PERIOD_LABELS_CLASS =
  "flex justify-between text-[11px] uppercase tracking-[0.14em] text-foreground/50";

function ChartModeTabs({
  mode,
  onChange,
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {CHART_MODES.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          size="xs"
          variant={mode === value ? "default" : "outline"}
          className="px-2"
          onClick={() => onChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export function DashboardSavingsOverview({
  savingsRate,
  allocatedSavings,
  chartLabel,
  chartSeries,
}: {
  savingsRate: number;
  allocatedSavings: number;
  chartLabel: string;
  chartSeries: DashboardChartPoint[];
}) {
  const [chartMode, setChartMode] = useState<ChartMode>("flow");

  const maxRate = useMemo(
    () => Math.max(...chartSeries.map((point) => Math.abs(point.savingsRate)), 0.1),
    [chartSeries],
  );
  const maxFlow = useMemo(
    () => Math.max(...chartSeries.flatMap((point) => [Math.abs(point.saved), point.outflow]), 1),
    [chartSeries],
  );

  const hasAnyData = chartSeries.some(
    (p) => p.inflow > 0 || p.outflow > 0 || p.saved !== 0,
  );

  function renderRateChart() {
    const hasNegative = chartSeries.some((p) => p.savingsRate < 0);

    if (!hasAnyData) {
      return (
        <div className="flex h-36 items-center justify-center lg:h-44">
          <span className="text-xs text-foreground/40">No data for this period</span>
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        <div className="relative grid h-36 grid-cols-6 items-stretch gap-1.5 lg:h-44 lg:gap-2">
          {hasNegative ? (
            <div className="absolute inset-x-0 top-1/2 border-t border-border/30" />
          ) : null}
          {chartSeries.map((point, index) => {
            const pct = Math.max(
              (Math.abs(point.savingsRate) / maxRate) * 100,
              point.savingsRate === 0 ? 0 : 10,
            );
            const isCurrent = index === chartSeries.length - 1;
            const color =
              point.savingsRate > 0
                ? isCurrent
                  ? "bg-foreground"
                  : "bg-foreground/40"
                : point.savingsRate < 0
                  ? "bg-destructive"
                  : "bg-foreground/15";

            return (
              <div key={point.key} className="relative flex items-end">
                <div
                  className={`w-full ${color} ${hasNegative ? "absolute" : ""}`}
                  style={
                    hasNegative
                      ? point.savingsRate >= 0
                        ? { height: `${pct / 2}%`, bottom: "50%" }
                        : { height: `${pct / 2}%`, top: "50%" }
                      : { height: `${pct}%` }
                  }
                />
              </div>
            );
          })}
        </div>
        <div className={CHART_PERIOD_LABELS_CLASS}>
          <span>{chartSeries[0]?.label ?? chartLabel}</span>
          <span>{chartSeries[chartSeries.length - 1]?.label ?? "Current"}</span>
        </div>
      </div>
    );
  }

  function renderFlowChart() {
    return (
      <div className="grid gap-2">
        {/* Overlapping bars: outflow ghost behind, saved in front — full column width per period */}
        <div className="grid h-36 grid-cols-6 items-end gap-1.5 lg:h-44 lg:gap-2">
          {chartSeries.map((point, index) => {
            const outflowPct = Math.max(
              (point.outflow / maxFlow) * 100,
              point.outflow === 0 ? 0 : 6,
            );
            const savedPct = Math.max(
              (Math.abs(point.saved) / maxFlow) * 100,
              point.saved === 0 ? 0 : 6,
            );
            const isCurrent = index === chartSeries.length - 1;
            const savedColor =
              point.saved >= 0
                ? isCurrent
                  ? "bg-foreground"
                  : "bg-foreground/40"
                : "bg-destructive";

            return (
              <div key={point.key} className="relative flex items-end">
                {/* Outflow — ghost layer behind */}
                <div
                  className="absolute inset-x-0 bottom-0 bg-destructive/25"
                  style={{ height: `${outflowPct}%` }}
                />
                {/* Saved — solid layer in front */}
                <div
                  className={`relative w-full ${savedColor}`}
                  style={{ height: `${savedPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className={CHART_PERIOD_LABELS_CLASS}>
          <span>Saved</span>
          <span>Outflow</span>
        </div>
      </div>
    );
  }

  function renderAllocationChart() {
    return (
      <div className="grid gap-2">
        <div className="grid h-36 grid-cols-6 items-end gap-1.5 lg:h-44 lg:gap-2">
          {chartSeries.map((point, index) => {
            const inflow = Math.max(point.inflow, 0);
            const savedShare = inflow > 0 ? Math.max(point.saved, 0) / inflow : 0;
            const spentShare = inflow > 0 ? Math.min(point.outflow / inflow, 1) : 0;
            const isCurrent = index === chartSeries.length - 1;
            return (
              <div
                key={point.key}
                className="flex h-full flex-col justify-end overflow-hidden border border-border/20"
              >
                <div
                  className={isCurrent ? "bg-foreground" : "bg-foreground/40"}
                  style={{ height: `${savedShare * 100}%` }}
                />
                <div
                  className="bg-destructive/55"
                  style={{ height: `${spentShare * 100}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className={CHART_PERIOD_LABELS_CLASS}>
          <span>Saved share</span>
          <span>Spent share</span>
        </div>
      </div>
    );
  }

  const chart =
    chartMode === "rate"
      ? renderRateChart()
      : chartMode === "flow"
        ? renderFlowChart()
        : renderAllocationChart();

  return (
    <Card className="moat-panel-sage border-border/20 shadow-none">
      <CardContent className="p-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-8 lg:items-center">

          {/* Stat column */}
          <div className="space-y-4">
            {/* Label row: "Savings rate" left, tabs right (mobile only) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-foreground/65">
                <span>Savings rate</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-4.5 text-foreground/60 hover:text-foreground"
                      aria-label="Savings rate explanation"
                    >
                      <IconInfoCircle className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="max-w-xs">
                    <PopoverHeader>
                      <PopoverTitle>Savings rate</PopoverTitle>
                      <PopoverDescription>
                        Based only on the selected period. This uses inflow minus outflow.
                        Tagged savings contributions stay separate to avoid double counting.
                        Current account balances below include opening balances and prior history.
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              {/* Tabs — visible on mobile, hidden on lg (shown in chart column instead) */}
              <div className="lg:hidden">
                <ChartModeTabs mode={chartMode} onChange={setChartMode} />
              </div>
            </div>

            <AmountIndicator
              tone={savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "neutral"}
              sign={savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "none"}
              value={`${Math.round(savingsRate * 100)}%`}
              className="text-5xl font-semibold tracking-tight sm:text-6xl"
            />

            <p className="text-xs text-foreground/65">
              Tagged savings contributions:{" "}
              <span className="font-medium text-foreground">{formatCurrency(allocatedSavings)}</span>
            </p>
          </div>

          {/* Chart column */}
          <div className="grid gap-3">
            {/* Tabs — hidden on mobile (shown in stat column), visible on lg */}
            <div className="hidden justify-end lg:flex">
              <ChartModeTabs mode={chartMode} onChange={setChartMode} />
            </div>
            {chart}
            <p className="text-[11px] text-foreground/50">
              Last six {chartLabel.toLowerCase()} periods.
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardCashFlowSection({
  summaryTiles,
  savingsRate,
  allocatedSavings,
  chartLabel,
  chartSeries,
}: {
  summaryTiles: SummaryTile[];
  savingsRate: number;
  allocatedSavings: number;
  chartLabel: string;
  chartSeries: DashboardChartPoint[];
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
      <DashboardSavingsOverview
        savingsRate={savingsRate}
        allocatedSavings={allocatedSavings}
        chartLabel={chartLabel}
        chartSeries={chartSeries}
      />
      <DashboardSummaryTiles items={summaryTiles} />
    </div>
  );
}

export function DashboardTopSpendingCategories({
  categories,
}: {
  categories: {
    categoryId: string;
    categoryName: string;
    amount: number;
  }[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Top spending categories</CardTitle>
        <CardDescription>Selected period only. Transfers are excluded.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {categories.length === 0 ? (
          <EmptyState>
            No spending recorded in this period.{" "}
            <Link href="/transactions" className="underline underline-offset-4 hover:text-foreground">
              Add transactions
            </Link>
          </EmptyState>
        ) : (
          categories.map((category, index) => (
            <div
              key={category.categoryId}
              className={`flex items-center justify-between gap-4 border px-4 py-3 ${
                index === 0
                  ? "moat-panel-mint border-border/20"
                  : index === 1
                    ? "moat-panel-yellow border-border/20"
                    : index === 2
                      ? "moat-panel-sage border-border/20"
                      : "bg-muted/25 border-border/20"
              }`}
            >
              <span className="text-sm font-medium text-foreground">{category.categoryName}</span>
              <AmountIndicator
                tone="negative"
                sign="negative"
                value={formatCurrency(category.amount)}
                className="text-base font-semibold"
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardAccountBalances({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Current account balances</CardTitle>
        <CardDescription>
          All recorded history plus opening balances, independent of the filter.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {accounts.length === 0 ? (
          <EmptyState>
            No accounts.{" "}
            <Link href="/accounts" className="underline underline-offset-4 hover:text-foreground">
              Add an account
            </Link>
          </EmptyState>
        ) : (
          accounts.map((account, index) => (
            <div
              key={account.id}
              className={`grid gap-2 border px-4 py-3 ${
                index % 2 === 0 ? "moat-panel-sage border-border/20" : "bg-muted/20 border-border/20"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">{account.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {account.type.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                    <Link href={`/accounts/${encodeURIComponent(account.id)}`}>Ledger</Link>
                  </Button>
                  <AmountIndicator
                    tone={account.balance < 0 ? "negative" : "neutral"}
                    sign={account.balance < 0 ? "negative" : "none"}
                    value={formatCurrency(account.balance)}
                    className="text-sm font-medium"
                  />
                </div>
              </div>
              <AccountBalanceBreakdown account={account} transactions={transactions} compact />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardInsightsPanel({
  insights,
}: {
  insights: { id: string; title: string; body: string }[];
}) {
  return (
    <Card className="moat-panel-lilac border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">This period</CardTitle>
        <CardDescription className="text-foreground/65">
          Prompts from the selected time window.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <EmptyState className="border-border/30 bg-background/10 py-6 text-foreground/75">
            Add more transactions for personalised prompts.
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {insights.map((insight) => (
              <li key={insight.id} className="flex gap-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 bg-foreground" />
                <span className="leading-6 text-foreground/80">
                  <span className="font-medium text-foreground">{insight.title}: </span>
                  {insight.body}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardContinueLinks({
  modules,
}: {
  modules: { href: string; title: string; stage: string; summary: string }[];
}) {
  return (
    <section className="grid gap-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-foreground">Continue</h2>
        <p className="text-xs text-muted-foreground">Jump to any section.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group border-b border-border/30 px-0 py-3 transition-colors hover:border-foreground/40"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{module.title}</span>
              <span className="text-xs text-muted-foreground">{module.stage}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DashboardQuickActions({
  actions,
}: {
  actions: { href: string; title: string }[];
}) {
  return (
    <section className="grid gap-3 lg:hidden">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-foreground">Quick actions</h2>
        <p className="text-xs text-muted-foreground">Jump straight into the next task.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <Button key={action.href} asChild variant="outline" className="h-10 justify-center px-3 text-xs">
            <Link href={action.href}>{action.title}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
