"use client";

import type { MonthClose } from "@/lib/types";
import type { DuplicateGroup, MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { AccentCardHeader } from "@/components/accent-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatMonthLabel(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? period
    : date.toLocaleDateString("en-UG", { month: "long", year: "numeric" });
}

type Props = {
  period: string;
  monthClose: MonthClose | null;
  evaluation: MonthCloseEvaluation;
  recurringEvaluations: RecurringEvaluation[];
  isSubmitting: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onExport: () => void;
};

function DetailList({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: unknown[];
  renderItem: (item: unknown, index: number) => string;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">None</div>
      ) : (
        items.slice(0, 5).map((item, index) => (
          <div key={`${title}:${index}`} className="text-sm text-foreground/82">
            {renderItem(item, index)}
          </div>
        ))
      )}
    </div>
  );
}

export function MonthClosePanel({
  period,
  monthClose,
  evaluation,
  recurringEvaluations,
  isSubmitting,
  onRefresh,
  onClose,
  onExport,
}: Props) {
  const monthLabel = formatMonthLabel(period);
  const missingObligations = recurringEvaluations.filter((entry) => entry.state !== "paid");
  const allClear =
    evaluation.unresolvedTransactions.length === 0 &&
    evaluation.duplicateGroups.length === 0 &&
    missingObligations.length === 0;

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="lilac"
        title={`Month close · ${monthLabel}`}
        description="Clear any unresolved items, duplicates, and missing bills before closing the month."
      />
      <CardContent className="grid gap-4 p-5">
        {monthClose?.state === "closed" ? (
          <p className="text-sm text-pos">This month is closed.</p>
        ) : allClear ? (
          <p className="text-sm text-pos">
            {`All clear for ${monthLabel} — nothing to resolve. You're ready to close the month.`}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {evaluation.unresolvedTransactions.length > 0 ? (
              <DetailList
                title={`Unresolved (${evaluation.unresolvedTransactions.length})`}
                items={evaluation.unresolvedTransactions}
                renderItem={(item) => {
                  const transaction = item as MonthCloseEvaluation["unresolvedTransactions"][number];
                  return `${transaction.occurredOn} · ${Math.abs(transaction.amount)}`;
                }}
              />
            ) : null}
            {evaluation.duplicateGroups.length > 0 ? (
              <DetailList
                title={`Likely duplicates (${evaluation.duplicateGroups.length})`}
                items={evaluation.duplicateGroups}
                renderItem={(item) => {
                  const group = item as DuplicateGroup;
                  return `${group.transactions.length} records look the same`;
                }}
              />
            ) : null}
            {missingObligations.length > 0 ? (
              <DetailList
                title={`Missing bills (${missingObligations.length})`}
                items={missingObligations}
                renderItem={(item) => (item as RecurringEvaluation).obligation.name}
              />
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
            Refresh checks
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onExport}>
            Export CSV
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !evaluation.isReadyToClose}
            onClick={onClose}
          >
            Close month
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
