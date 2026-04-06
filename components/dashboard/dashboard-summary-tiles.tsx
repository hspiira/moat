"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function DashboardSummaryTiles({ items }: { items: SummaryTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
      {items.map((item) => (
        <Card key={item.label} className={`${item.className} border-border/20 shadow-none`}>
          <CardHeader className="gap-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <CardDescription className="text-foreground/65">{item.label}</CardDescription>
              <AmountIndicator
                tone={item.changeTone}
                direction={item.changeDirection}
                showIcon={item.change.kind !== "none"}
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
                  item.change.kind === "none"
                    ? "—"
                    : item.change.kind === "new"
                      ? "New"
                      : `${Math.abs(item.change.value ?? 0).toFixed(0)}%`
                }
                className="text-xs font-medium"
                iconClassName="h-3.5 w-3.5"
              />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              <AmountIndicator
                tone={item.tone}
                sign={item.sign}
                value={item.value}
                className="text-2xl font-semibold tracking-tight"
              />
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
