"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { BudgetEnvelope } from "@/lib/domain/budgets";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardBudgetCoverage({
  hasBudgets,
  allocated,
  spent,
  remaining,
  envelopes,
}: {
  hasBudgets: boolean;
  allocated: number;
  spent: number;
  remaining: number;
  envelopes: BudgetEnvelope[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Budget coverage</CardTitle>
        <CardDescription>
          Current month only. Envelopes track allocated, spent, and remaining.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!hasBudgets ? (
          <div className="text-sm text-muted-foreground">
            No budgets set yet. Add envelopes from Transactions.
          </div>
        ) : (
          <>
            <div className="grid gap-2 border border-border/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground/72">Allocated</span>
                <AmountIndicator tone="neutral" sign="none" value={formatCurrency(allocated)} className="text-sm font-medium" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground/72">Spent</span>
                <AmountIndicator tone="negative" sign="negative" value={formatCurrency(spent)} className="text-sm font-medium" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground/72">Remaining</span>
                <AmountIndicator
                  tone={remaining > 0 ? "positive" : remaining < 0 ? "negative" : "neutral"}
                  sign={remaining > 0 ? "positive" : remaining < 0 ? "negative" : "none"}
                  value={formatCurrency(Math.abs(remaining))}
                  className="text-sm font-medium"
                />
              </div>
            </div>

            {envelopes.map((envelope) => (
              <div
                key={envelope.categoryId}
                className="flex items-center justify-between gap-3 border border-border/20 px-4 py-3 text-sm"
              >
                <span className="text-foreground">{envelope.categoryName}</span>
                <AmountIndicator
                  tone={
                    envelope.remaining > 0
                      ? "positive"
                      : envelope.remaining < 0
                        ? "negative"
                        : "neutral"
                  }
                  sign={
                    envelope.remaining > 0
                      ? "positive"
                      : envelope.remaining < 0
                        ? "negative"
                        : "none"
                  }
                  value={formatCurrency(Math.abs(envelope.remaining))}
                  className="text-sm font-medium"
                />
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
