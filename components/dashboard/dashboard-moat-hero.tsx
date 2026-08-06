"use client";

import { IconArrowDownLeft, IconArrowUpRight, IconEqual } from "@tabler/icons-react";

import { AmountIndicator } from "@/components/amount-indicator";
import { MoatRing } from "@/components/moat/moat-ring";
import { Money } from "@/components/ui/money";
import { Card, CardContent } from "@/components/ui/card";
import type { ChangeMetric } from "@/lib/domain/dashboard";

const TARGET_MONTHS = 3;

/**
 * Period-over-period delta shown beside a flow figure. Lives here rather than in
 * its own card: the standalone summary tiles repeated the same inflow/outflow
 * numbers this hero already shows, and the delta was the only thing they added.
 *
 * `invertTone` because direction and desirability come apart — more money in is
 * good, more money out is not, but both point up.
 */
function ChangeBadge({ change, invertTone }: { change: ChangeMetric; invertTone?: boolean }) {
  if (change.kind === "none") {
    return null;
  }

  if (change.kind === "new") {
    return (
      <AmountIndicator
        tone={invertTone ? "negative" : "positive"}
        direction="up"
        showIcon
        value="New"
        className="text-[0.7rem] font-medium"
        iconClassName="h-3 w-3"
      />
    );
  }

  const value = change.value ?? 0;
  const rose = value > 0;
  const isGood = invertTone ? !rose : rose;

  return (
    <AmountIndicator
      tone={value === 0 ? "neutral" : isGood ? "positive" : "negative"}
      direction={value === 0 ? "flat" : rose ? "up" : "down"}
      showIcon
      value={`${Math.abs(value).toFixed(0)}%`}
      className="text-[0.7rem] font-medium"
      iconClassName="h-3 w-3"
    />
  );
}

/**
 * Dashboard hero: the moat itself. Answers "how protected am I?" before
 * "what's my balance?" — total position paired with months of cover shown
 * as the signature ring, then this period's flow.
 */
export function DashboardMoatHero({
  totalBalance,
  accountCount,
  monthlyOutflow,
  inflow,
  outflow,
  net,
  periodLabel,
  inflowChange,
  outflowChange,
}: {
  totalBalance: number;
  accountCount: number;
  monthlyOutflow: number;
  inflow: number;
  outflow: number;
  net: number;
  periodLabel: string;
  inflowChange: ChangeMetric;
  outflowChange: ChangeMetric;
}) {
  const hasCoverSignal = monthlyOutflow > 0 && totalBalance > 0;
  const runwayMonths = hasCoverSignal ? totalBalance / monthlyOutflow : 0;
  const ringValue = hasCoverSignal ? runwayMonths / TARGET_MONTHS : 0;
  const runwayLabel = hasCoverSignal
    ? runwayMonths >= 100
      ? "99+"
      : runwayMonths.toFixed(1)
    : "—";
  const coverAria = hasCoverSignal
    ? `Emergency cover: ${runwayMonths.toFixed(1)} of ${TARGET_MONTHS} target months of expenses`
    : "Emergency cover: not enough data yet";
  const ringTone = runwayMonths >= TARGET_MONTHS ? "positive" : "moat";

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 px-5 py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:px-7">
        <div className="flex flex-col items-center gap-2 justify-self-center sm:justify-self-start">
          <MoatRing
            value={ringValue}
            tone={ringTone}
            ariaLabel={coverAria}
            label={runwayLabel}
            sublabel={hasCoverSignal ? "months\ncover" : "no data"}
            size={148}
            thickness={12}
          />
          <p className="text-xs text-muted-foreground">Target: {TARGET_MONTHS} months</p>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Your moat
            </p>
            <div className="font-display text-3xl leading-none font-semibold tracking-tight text-foreground sm:text-4xl">
              <Money amount={totalBalance} tone="neutral" className="font-display" />
            </div>
            <p className="text-sm text-muted-foreground">
              across {accountCount} {accountCount === 1 ? "account" : "accounts"}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-3 sm:gap-3">
            <FlowStat
              icon={<IconArrowDownLeft className="size-3.5" />}
              label="In"
              periodLabel={periodLabel}
              change={<ChangeBadge change={inflowChange} />}
            >
              <Money amount={inflow} tone="positive" />
            </FlowStat>
            <FlowStat
              icon={<IconArrowUpRight className="size-3.5" />}
              label="Out"
              periodLabel={periodLabel}
              change={<ChangeBadge change={outflowChange} invertTone />}
            >
              <Money amount={outflow} tone="negative" />
            </FlowStat>
            <FlowStat
              icon={<IconEqual className="size-3.5" />}
              label="Net"
              periodLabel={periodLabel}
            >
              <Money amount={net} tone="auto" signed />
            </FlowStat>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function FlowStat({
  icon,
  label,
  periodLabel,
  change,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  periodLabel: string;
  change?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // Mobile: full-width label/value row so money never has to wrap.
    // sm and up: stacked label-over-value in a three-column band.
    <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block sm:space-y-1">
      <dt className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
        <span className="sr-only"> {periodLabel}</span>
      </dt>
      <dd className="flex min-w-0 items-baseline justify-end gap-1.5 text-sm font-semibold sm:justify-start sm:text-base">
        {children}
        {change}
      </dd>
    </div>
  );
}
