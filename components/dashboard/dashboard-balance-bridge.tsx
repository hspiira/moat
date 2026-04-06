"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  return (
    <Card className="moat-panel-lilac border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Period balance bridge</CardTitle>
        <CardDescription className="text-foreground/65">
          Opening plus movement equals closing for the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {[
          ["Opening balance", openingBalance],
          ["Inflow", inflow],
          ["Outflow", -outflow],
          ["Allocated savings", -allocatedSavings],
          ["Movement", movement],
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
              value={formatCurrency(Math.abs(Number(amount)))}
              className="text-sm font-medium"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
