"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronRight, IconInfoCircle } from "@tabler/icons-react";

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
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

type ChartMode = "rate" | "flow" | "allocation";

const CHART_MODES: { value: ChartMode; label: string }[] = [
  { value: "rate", label: "Savings" },
  { value: "flow", label: "Cash flow" },
  { value: "allocation", label: "Allocation" },
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
    <div
      role="tablist"
      aria-label="Chart view"
      className="flex w-full items-center rounded-lg border border-border/60 bg-muted/30 p-0.5 lg:w-auto"
    >
      {CHART_MODES.map(({ value, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors lg:flex-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Present the savings rate as a headline. A raw percentage beyond ±100% reads
 * as absurd (spending 5× income shows "-400%"), so deep deficits switch to a
 * plain multiple of income spent.
 */
function describeSavingsRate(
  hasIncome: boolean,
  savingsRate: number,
): {
  value: string;
  tone: "positive" | "negative" | "neutral";
  sign: "positive" | "negative" | "none";
  note: string | null;
} {
  if (!hasIncome) {
    return { value: "—", tone: "neutral", sign: "none", note: null };
  }
  if (savingsRate === 0) {
    return { value: "0%", tone: "neutral", sign: "none", note: null };
  }
  if (savingsRate > 0) {
    return { value: `${Math.round(savingsRate * 100)}%`, tone: "positive", sign: "positive", note: null };
  }
  // Deficit. Below -100% the percentage stops being meaningful, so show how
  // many times income was spent instead (outflow / income = 1 - rate).
  if (savingsRate <= -1) {
    const multiple = 1 - savingsRate;
    const label = multiple >= 10 ? String(Math.round(multiple)) : multiple.toFixed(1).replace(/\.0$/, "");
    return { value: `${label}×`, tone: "negative", sign: "none", note: "Spent this many times your income this period." };
  }
  return { value: `${Math.round(savingsRate * 100)}%`, tone: "negative", sign: "negative", note: null };
}

export function DashboardSavingsOverview({
  savingsRate,
  hasIncome,
  allocatedSavings,
  chartLabel,
  chartSeries,
}: {
  savingsRate: number;
  hasIncome: boolean;
  allocatedSavings: number;
  chartLabel: string;
  chartSeries: DashboardChartPoint[];
}) {
  const [chartMode, setChartMode] = useState<ChartMode>("flow");

  const savings = describeSavingsRate(hasIncome, savingsRate);

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
        {/* Diverging around zero: saved rises when the month built the moat and
            drops when it drained it; outflow always points down (money out) as
            muted context. Direction carries the meaning; color reinforces it. */}
        <div className="relative grid h-36 grid-cols-6 gap-1.5 lg:h-44 lg:gap-2">
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-border/40" />
          {chartSeries.map((point, index) => {
            const isCurrent = index === chartSeries.length - 1;
            // Half the plot is above zero, half below, so scale to 50%.
            const outflowPct = Math.max(
              (point.outflow / maxFlow) * 50,
              point.outflow === 0 ? 0 : 3,
            );
            const savedPct = Math.max(
              (Math.abs(point.saved) / maxFlow) * 50,
              point.saved === 0 ? 0 : 3,
            );
            const savedUp = point.saved > 0;
            const savedColor = savedUp
              ? isCurrent
                ? "bg-pos"
                : "bg-pos/50"
              : isCurrent
                ? "bg-neg"
                : "bg-neg/50";
            const summaryText = `${point.label}: saved ${formatMoney(point.saved)}, outflow ${formatMoney(point.outflow)}`;

            return (
              <div key={point.key} className="relative" role="img" aria-label={summaryText} title={summaryText}>
                {/* Saved — left half of the column, up or down by sign */}
                <div
                  className={`absolute right-1/2 left-0 mr-px ${savedColor} ${savedUp ? "rounded-t-lg" : "rounded-b-lg"}`}
                  style={
                    savedUp
                      ? { bottom: "50%", height: `${savedPct}%` }
                      : { top: "50%", height: `${savedPct}%` }
                  }
                />
                {/* Outflow — right half, always downward, muted context */}
                <div
                  className={`absolute right-0 left-1/2 ml-px rounded-b-lg ${
                    isCurrent ? "bg-muted-foreground/40" : "bg-muted-foreground/25"
                  }`}
                  style={{ top: "50%", height: `${outflowPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-xs bg-pos" />
            Added to moat
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-xs bg-neg" />
            Drained
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-xs bg-muted-foreground/40" />
            Outflow
          </span>
        </div>
        <div className={CHART_PERIOD_LABELS_CLASS}>
          <span>{chartSeries[0]?.label ?? chartLabel}</span>
          <span>{chartSeries[chartSeries.length - 1]?.label ?? "Current"}</span>
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
            {/* Label + info, then the view switcher on its own row (mobile). */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
                        For the selected period: what&apos;s left after spending, as a share of
                        income. Money you tagged as savings is counted separately.
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              {/* View switcher — full-width segmented control on mobile, moved
                  into the chart column on lg. */}
              <div className="lg:hidden">
                <ChartModeTabs mode={chartMode} onChange={setChartMode} />
              </div>
            </div>

            <AmountIndicator
              tone={savings.tone}
              sign={savings.sign}
              value={savings.value}
              className="text-5xl font-semibold tracking-tight sm:text-6xl"
            />

            <p className="text-xs text-foreground/65">
              {hasIncome ? (
                <>
                  {savings.note ? <>{savings.note} </> : null}
                  Tagged savings contributions:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(allocatedSavings)}
                  </span>
                </>
              ) : (
                <>
                  No income recorded this period, so the rate can&apos;t be computed. Tagged
                  savings contributions:{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(allocatedSavings)}
                  </span>
                </>
              )}
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
  hasIncome,
  allocatedSavings,
  chartLabel,
  chartSeries,
}: {
  summaryTiles: SummaryTile[];
  savingsRate: number;
  hasIncome: boolean;
  allocatedSavings: number;
  chartLabel: string;
  chartSeries: DashboardChartPoint[];
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
      <DashboardSavingsOverview
        savingsRate={savingsRate}
        hasIncome={hasIncome}
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
          (() => {
            const maxAmount = Math.max(...categories.map((c) => c.amount), 1);
            return categories.map((category) => (
              <div key={category.categoryId} className="grid gap-1.5 py-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate text-sm font-medium text-foreground">
                    {category.categoryName}
                  </span>
                  <AmountIndicator
                    tone="negative"
                    sign="negative"
                    value={formatMoney(category.amount)}
                    className="shrink-0 text-sm font-semibold tabular-nums"
                  />
                </div>
                {/* Proportional bar — share of the largest category this period. */}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-neg/45"
                    style={{ width: `${Math.max(6, (category.amount / maxAmount) * 100)}%` }}
                  />
                </div>
              </div>
            ));
          })()
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
              className={`-mx-4 grid gap-2 border-y px-4 py-3 sm:mx-0 sm:border-x ${
                index % 2 === 0 ? "moat-panel-sage border-border/20" : "bg-muted/20 border-border/20"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <Link
                  href={`/accounts/${encodeURIComponent(account.id)}`}
                  className="group flex min-w-0 flex-1 items-center gap-1"
                  aria-label={`Open ${account.name} ledger`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {account.type.replaceAll("_", " ")}
                    </div>
                  </div>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <AmountIndicator
                  tone={
                    account.balance > 0
                      ? "positive"
                      : account.balance < 0
                        ? "negative"
                        : "neutral"
                  }
                  sign={
                    account.balance > 0
                      ? "positive"
                      : account.balance < 0
                        ? "negative"
                        : "none"
                  }
                  value={formatMoney(account.balance)}
                  className="shrink-0 text-sm font-medium"
                />
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
