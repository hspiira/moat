"use client";

import type { ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";

import type { MonthSummary } from "@/lib/types";
import { Money } from "@/components/ui/money";

type Props = {
  recordedCount: number;
  transactionCount: number;
  reviewCount: number;
  captureInboxCount: number;
  duplicateCount: number;
  summary: MonthSummary;
};

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// These totals are always the calendar month, while the list below has its own
// period. Saying "this month" on the label keeps the two from being read as one
// control.
export function TransactionsSummaryStrip({
  recordedCount,
  transactionCount,
  reviewCount,
  captureInboxCount,
  duplicateCount,
  summary,
}: Props) {
  return (
    <details className="group rounded-lg border border-border/60 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {/* Amounts wrap onto their own line rather than being clipped: a
            truncated figure is worse than a taller row. */}
        <span className="grid min-w-0 gap-0.5">
          <span className="font-medium">This month&rsquo;s summary</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            <Money amount={summary.inflow} tone="positive" /> in ·{" "}
            <Money amount={summary.outflow} tone="negative" /> out
          </span>
        </span>
        <IconChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <dl className="divide-y divide-border/60 border-t border-border/60">
        <SummaryRow label="Recorded this month" value={transactionCount} />
        <SummaryRow label="Recorded in total" value={recordedCount} />
        {reviewCount > 0 ? (
          <SummaryRow
            label="Needs review this month"
            value={<span className="text-clay">{reviewCount}</span>}
          />
        ) : null}
        {captureInboxCount > 0 ? (
          <SummaryRow
            label="Waiting in capture inbox"
            value={<span className="text-clay">{captureInboxCount}</span>}
          />
        ) : null}
        {duplicateCount > 0 ? (
          <SummaryRow
            label="Possible duplicates"
            value={<span className="text-clay">{duplicateCount}</span>}
          />
        ) : null}
      </dl>
    </details>
  );
}
