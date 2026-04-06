"use client";

import { formatMoney } from "@/lib/currency";
import { AmountIndicator } from "@/components/amount-indicator";
import { getDebtSummary } from "@/lib/domain/debt";
import type { Account, Transaction } from "@/lib/types";

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
          value={formatMoney(summary.principal, "UGX")}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Outstanding</span>
        <AmountIndicator
          tone={summary.outstandingBalance > 0 ? "negative" : "neutral"}
          sign={summary.outstandingBalance > 0 ? "negative" : "none"}
          value={formatMoney(summary.outstandingBalance, "UGX")}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Interest rate</span>
        <span className="text-foreground">
          {summary.interestRate}% · {summary.interestModel === "flat" ? "flat" : "reducing"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Min / avg payment</span>
        <AmountIndicator
          tone={summary.averagePayment > 0 ? "positive" : "neutral"}
          sign={summary.averagePayment > 0 ? "positive" : "none"}
          value={`${formatMoney(summary.inferredMinimumPayment, "UGX")} · ${formatMoney(
            summary.averagePayment,
            "UGX",
          )}`}
          className="text-sm font-medium"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Monthly interest</span>
        <span className="text-foreground">{formatMoney(summary.estimatedMonthlyInterest, "UGX")}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Payoff estimate</span>
        <span className="text-foreground">
          {summary.estimatedPayoffMonths !== null
            ? `${summary.estimatedPayoffMonths} months`
            : "Needs higher payments"}
        </span>
      </div>
      {summary.warning ? (
        <div className="text-xs text-destructive">{summary.warning}</div>
      ) : null}
    </div>
  );
}
