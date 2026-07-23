"use client";

import type { ReactNode } from "react";

import type { MonthSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";

type Props = {
  recordedCount: number;
  transactionCount: number;
  reviewCount: number;
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

export function TransactionsSummaryStrip({
  recordedCount,
  transactionCount,
  reviewCount,
  duplicateCount,
  summary,
}: Props) {
  return (
    <Card className="py-1">
      <CardContent className="px-0">
        <dl className="divide-y divide-border/60">
          <SummaryRow label="Recorded" value={recordedCount} />
          <SummaryRow label="This month" value={transactionCount} />
          {reviewCount > 0 ? (
            <SummaryRow label="Needs review" value={<span className="text-clay">{reviewCount}</span>} />
          ) : null}
          {duplicateCount > 0 ? (
            <SummaryRow label="Duplicates" value={<span className="text-clay">{duplicateCount}</span>} />
          ) : null}
          <SummaryRow label="Inflow" value={<Money amount={summary.inflow} tone="positive" />} />
          <SummaryRow label="Outflow" value={<Money amount={summary.outflow} tone="negative" />} />
        </dl>
      </CardContent>
    </Card>
  );
}
