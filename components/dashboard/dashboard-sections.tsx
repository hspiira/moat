"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IconChevronRight, IconInfoCircle } from "@tabler/icons-react";

import { AmountIndicator } from "@/components/amount-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AttentionItem } from "@/lib/domain/attention";
import type { DashboardChartPoint } from "@/lib/domain/dashboard";
import { formatMoney } from "@/lib/currency";

const CHART_PERIOD_LABELS_CLASS =
  "flex justify-between text-[11px] text-muted-foreground";

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
  const savings = describeSavingsRate(hasIncome, savingsRate);

  const maxFlow = useMemo(
    () => Math.max(...chartSeries.flatMap((point) => [Math.abs(point.saved), point.outflow]), 1),
    [chartSeries],
  );

  const hasAnyData = chartSeries.some(
    (p) => p.inflow > 0 || p.outflow > 0 || p.saved !== 0,
  );

  function renderFlowChart() {
    if (!hasAnyData) {
      return (
        <div className="flex h-36 items-center justify-center lg:h-44">
          <span className="text-xs text-muted-foreground">No data for this period</span>
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        {/* Diverging around zero: saved rises when the month built the moat and
            drops when it drained it; outflow always points down (money out) as
            muted context. Direction carries the meaning; color reinforces it. */}
        <div className="relative grid h-36 grid-cols-6 gap-1.5 lg:h-44 lg:gap-2">
          <div aria-hidden className="absolute inset-x-0 top-1/2" />
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


  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-8">

          <div className="space-y-4">
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
            </div>

            <AmountIndicator
              tone={savings.tone}
              sign={savings.sign}
              value={savings.value}
              className="text-5xl font-semibold tracking-tight sm:text-6xl"
            />

            <p className="text-xs text-muted-foreground">
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

          <div className="grid gap-3">
            {renderFlowChart()}
            <p className="text-[11px] text-muted-foreground">
              Last six {chartLabel.toLowerCase()} periods.
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardCashFlowSection({
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
  // The summary tiles that used to sit beside this repeated the inflow and
  // outflow figures already shown in the hero, and their savings tile repeated
  // the savings overview below. Their period deltas now live on the hero's
  // In/Out stats instead.
  return (
    <DashboardSavingsOverview
      savingsRate={savingsRate}
      hasIncome={hasIncome}
      allocatedSavings={allocatedSavings}
      chartLabel={chartLabel}
      chartSeries={chartSeries}
    />
  );
}

export function DashboardTopSpendingCategories({
  categories,
}: {
  categories: {
    categoryId: string;
    categoryName: string;
    amount: number;
    count: number;
  }[];
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Where it went</CardTitle>
        <CardDescription>Selected period only. Transfers are excluded.</CardDescription>
        <CardAction>
          <Link
            href="/transactions"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            See all ›
          </Link>
        </CardAction>
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
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {category.categoryName}
                    {/* Frequency changes the meaning: 23 small buys and 4 big
                        ones can total the same and need different answers. */}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                      {category.count}×
                    </span>
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

export function DashboardAttentionPanel({ items }: { items: AttentionItem[] }) {
  // Nothing to say means say nothing. A card whose only content is "nothing
  // needs attention" spends prime vertical space reporting an absence.
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">
          Needs attention{" "}
          <span className="font-normal text-muted-foreground tabular-nums">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1">
          {items.map((item) => {
            const body = (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                  <span className="text-xs leading-5 text-muted-foreground">{item.body}</span>
                </span>
                {item.href ? (
                  <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                ) : null}
              </>
            );

            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
