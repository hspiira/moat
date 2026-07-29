"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { IconChevronDown } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";

export function DashboardBalanceBridge({
  openingBalance,
  inflow,
  outflow,
  allocatedSavings,
  movement,
  closingBalance,
}: {
  openingBalance: number;
  inflow: number;
  outflow: number;
  allocatedSavings: number;
  movement: number;
  closingBalance: number;
}) {
  // Collapsed by default. This is a six-row reconciliation table — the thing you
  // open when a balance looks wrong, not something you read every day. Native
  // <details> so it works without JS and stays keyboard-accessible for free.
  return (
    <Card className="moat-panel-lilac border-border/20 py-0 shadow-none">
      <details className="group/bridge">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="grid gap-0.5 text-left">
            <span className="text-base font-medium">How your balance changed</span>
            <span className="text-xs text-foreground/65">
              Opening balance plus this period&apos;s movement.
            </span>
          </span>
          <IconChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-foreground/60 transition-transform group-open/bridge:rotate-180"
          />
        </summary>
        <CardContent className="grid gap-2 px-4 pt-0 pb-4 text-sm">
        {[
          ["Opening balance", openingBalance],
          ["Inflow", inflow],
          ["Outflow", -outflow],
          ["Allocated savings", -allocatedSavings],
          ["Net change", movement],
          ["Closing balance", closingBalance],
        ].map(([label, amount]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-border/15 pb-2 last:border-b-0 last:pb-0"
          >
            <span className="text-foreground/72">{label}</span>
            <AmountIndicator
              tone={
                Number(amount) > 0
                  ? "positive"
                  : Number(amount) < 0
                    ? "negative"
                    : "neutral"
              }
              sign={
                Number(amount) > 0
                  ? "positive"
                  : Number(amount) < 0
                    ? "negative"
                    : "none"
              }
              value={formatMoney(Math.abs(Number(amount)))}
              className="text-sm font-medium"
            />
          </div>
        ))}
        </CardContent>
      </details>
    </Card>
  );
}
