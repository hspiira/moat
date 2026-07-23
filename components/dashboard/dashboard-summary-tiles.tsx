"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { Card, CardContent } from "@/components/ui/card";
import type { ChangeMetric } from "@/lib/domain/dashboard";

export type SummaryTile = {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  sign: "positive" | "negative" | "none";
  change: ChangeMetric;
  changeTone: "positive" | "negative" | "neutral";
  changeDirection?: "up" | "down" | "flat";
  className: string;
};

/**
 * Compact full-width rows (label · value · vs-last-period). Full width so
 * large UGX sums never truncate — three separate cards wasted vertical space,
 * and squeezing them into columns clipped seven-figure values.
 */
export function DashboardSummaryTiles({ items }: { items: SummaryTile[] }) {
  return (
    <Card className="border-border/20 py-1 shadow-none">
      <CardContent className="divide-y divide-border/50 px-0">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <div className="flex items-baseline gap-2">
              {item.change.kind !== "none" ? (
                <AmountIndicator
                  tone={item.changeTone}
                  direction={item.changeDirection}
                  showIcon
                  sign={
                    item.change.kind === "new"
                      ? "positive"
                      : item.change.kind === "delta" && (item.change.value ?? 0) > 0
                        ? "positive"
                        : item.change.kind === "delta" && (item.change.value ?? 0) < 0
                          ? "negative"
                          : "none"
                  }
                  value={
                    item.change.kind === "new"
                      ? "New"
                      : `${Math.abs(item.change.value ?? 0).toFixed(0)}%`
                  }
                  className="text-[0.7rem] font-medium"
                  iconClassName="h-3 w-3"
                />
              ) : null}
              <AmountIndicator
                tone={item.tone}
                sign={item.sign}
                value={item.value}
                className="text-base font-semibold tracking-tight tabular-nums"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
