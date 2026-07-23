"use client";

import { IconArrowDownLeft, IconArrowUpRight, IconEqual } from "@tabler/icons-react";

import { MoatRing } from "@/components/moat/moat-ring";
import { Money } from "@/components/ui/money";
import { Card, CardContent } from "@/components/ui/card";

const TARGET_MONTHS = 3;

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
}: {
  totalBalance: number;
  accountCount: number;
  monthlyOutflow: number;
  inflow: number;
  outflow: number;
  net: number;
  periodLabel: string;
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
    <Card className="overflow-hidden ring-1 ring-primary/15">
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

          <dl className="grid grid-cols-1 gap-2 border-t border-border/60 pt-4 sm:grid-cols-3 sm:gap-3">
            <FlowStat
              icon={<IconArrowDownLeft className="size-3.5" />}
              label="In"
              periodLabel={periodLabel}
            >
              <Money amount={inflow} tone="positive" />
            </FlowStat>
            <FlowStat
              icon={<IconArrowUpRight className="size-3.5" />}
              label="Out"
              periodLabel={periodLabel}
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
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  periodLabel: string;
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
      <dd className="min-w-0 text-right text-sm font-semibold sm:text-left sm:text-base">
        {children}
      </dd>
    </div>
  );
}
