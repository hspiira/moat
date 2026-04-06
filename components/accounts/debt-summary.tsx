"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { getDebtSummary } from "@/lib/domain/debt";
import type { Account, Transaction } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DebtSummary({
  account,
  transactions,
}: {
  account: Account;
  transactions: Transaction[];
}) {
  const summary = getDebtSummary(account, transactions);

  if (!summary) {
    return null;
  }

  return (
    <div className="grid gap-2 border border-border/20 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Principal</span>
        <AmountIndicator
          tone="neutral"
          sign="none"
          value={formatCurrency(summary.principal)}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Outstanding</span>
        <AmountIndicator
          tone={summary.outstandingBalance > 0 ? "negative" : "neutral"}
          sign={summary.outstandingBalance > 0 ? "negative" : "none"}
          value={formatCurrency(summary.outstandingBalance)}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Interest rate</span>
        <span className="text-foreground">{summary.interestRate}%</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Avg payment</span>
        <AmountIndicator
          tone={summary.monthlyPayment > 0 ? "positive" : "neutral"}
          sign={summary.monthlyPayment > 0 ? "positive" : "none"}
          value={formatCurrency(summary.monthlyPayment)}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Payoff estimate</span>
        <span className="text-foreground">
          {summary.estimatedPayoffMonths !== null
            ? `${summary.estimatedPayoffMonths} months`
            : "Needs higher payments"}
        </span>
      </div>
    </div>
  );
}
