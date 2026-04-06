"use client";

import type { MonthClose } from "@/lib/types";
import type { DuplicateGroup, MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { AccentCardHeader } from "@/components/accent-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatMonthLabel(period: string) {
  const [year, month] = period.split("-");
  return `${month}-${year}`;
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
  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="lilac"
        title={`Month close · ${formatMonthLabel(period)}`}
        description="Review unresolved items, duplicates, and recurring expectations before closing."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["State", monthClose?.state ?? (evaluation.isReadyToClose ? "ready" : "open")],
            ["Unresolved", String(evaluation.unresolvedTransactions.length)],
            ["Duplicates", String(evaluation.duplicateGroups.length)],
            ["Missing obligations", String(evaluation.recurringMissingCount)],
          ].map(([label, value]) => (
            <div key={label} className="border border-border/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </div>
              <div className="mt-2 text-xl text-foreground">{value}</div>
            </div>
          ))}
        </div>

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

        <div className="grid gap-4 lg:grid-cols-3">
          <DetailList
            title="Unresolved transactions"
            items={evaluation.unresolvedTransactions}
            renderItem={(item) => {
              const transaction = item as MonthCloseEvaluation["unresolvedTransactions"][number];
              return `${transaction.occurredOn} · ${transaction.reconciliationState} · ${Math.abs(transaction.amount)}`;
            }}
          />
          <DetailList
            title="Likely duplicates"
            items={evaluation.duplicateGroups}
            renderItem={(item) => {
              const group = item as DuplicateGroup;
              return `${group.transactions.length} records share ${group.key}`;
            }}
          />
          <DetailList
            title="Missing obligations"
            items={recurringEvaluations.filter((entry) => entry.state !== "paid")}
            renderItem={(item) => {
              const evaluation = item as RecurringEvaluation;
              return `${evaluation.obligation.name} · ${evaluation.state}`;
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
