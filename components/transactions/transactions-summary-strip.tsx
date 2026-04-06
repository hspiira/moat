"use client";

import { formatMoney } from "@/lib/currency";
import type { MonthSummary } from "@/lib/types";
import { MetricChip } from "@/components/page-shell/metric-chip";

type Props = {
  transactionCount: number;
  reviewCount: number;
  duplicateCount: number;
  summary: MonthSummary;
};

export function TransactionsSummaryStrip({
  transactionCount,
  reviewCount,
  duplicateCount,
  summary,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricChip
        label="This month"
        value={<span className="text-lg font-semibold tracking-tight">{transactionCount}</span>}
        className="border-border/20 bg-muted/20"
      />
      <MetricChip
        label="Needs review"
        value={<span className="text-lg font-semibold tracking-tight">{reviewCount}</span>}
        className="border-border/20 bg-muted/20"
      />
      <MetricChip
        label="Duplicates"
        value={<span className="text-lg font-semibold tracking-tight">{duplicateCount}</span>}
        className="border-border/20 bg-muted/20"
      />
      <MetricChip
        label="Inflow"
        value={<span className="text-lg font-semibold tracking-tight">{formatMoney(summary.inflow, "UGX")}</span>}
        className="moat-panel-mint border-border/20"
      />
      <MetricChip
        label="Outflow"
        value={<span className="text-lg font-semibold tracking-tight">{formatMoney(summary.outflow, "UGX")}</span>}
        className="moat-panel-yellow border-border/20"
      />
    </div>
  );
}
