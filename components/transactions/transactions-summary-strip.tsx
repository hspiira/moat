"use client";

import type { MonthSummary } from "@/lib/types";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { Money } from "@/components/ui/money";

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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <MetricChip
        label="This month"
        value={<span className="text-lg font-semibold tracking-tight">{transactionCount}</span>}
      />
      <MetricChip
        label="Needs review"
        value={
          <span
            className={`text-lg font-semibold tracking-tight ${reviewCount > 0 ? "text-clay" : ""}`}
          >
            {reviewCount}
          </span>
        }
      />
      <MetricChip
        label="Duplicates"
        value={
          <span
            className={`text-lg font-semibold tracking-tight ${duplicateCount > 0 ? "text-clay" : ""}`}
          >
            {duplicateCount}
          </span>
        }
      />
      <MetricChip
        label="Inflow"
        value={<Money amount={summary.inflow} tone="positive" className="text-lg font-semibold" />}
      />
      <MetricChip
        label="Outflow"
        value={<Money amount={summary.outflow} tone="negative" className="text-lg font-semibold" />}
      />
    </div>
  );
}
