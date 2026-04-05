"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import {
  getAccountBalanceBreakdown,
  type AccountBalanceBreakdown,
} from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function BreakdownAmount({
  amount,
  positiveNeutral = false,
}: {
  amount: number;
  positiveNeutral?: boolean;
}) {
  return (
    <AmountIndicator
      tone={
        amount < 0 ? "negative" : amount > 0 && !positiveNeutral ? "positive" : "neutral"
      }
      sign={amount < 0 ? "negative" : amount > 0 ? "positive" : "none"}
      value={formatCurrency(Math.abs(amount))}
      className="text-[11px] font-medium"
    />
  );
}

export function AccountBalanceBreakdown({
  account,
  transactions,
  compact = false,
}: {
  account: Account;
  transactions: Transaction[];
  compact?: boolean;
}) {
  const breakdown = getAccountBalanceBreakdown(account, transactions);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/65">
        <span>
          Opening <BreakdownAmount amount={breakdown.openingBalance} positiveNeutral />
        </span>
        <span>
          Movement <BreakdownAmount amount={breakdown.movement} />
        </span>
        {account.type !== "debt" && breakdown.openingBalance < 0 ? (
          <span className="text-destructive">Check opening balance</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2 border border-border/20 px-4 py-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Opening</span>
          <BreakdownAmount amount={breakdown.openingBalance} positiveNeutral />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Current</span>
          <BreakdownAmount amount={breakdown.currentBalance} positiveNeutral />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Inflow</span>
          <BreakdownAmount amount={breakdown.inflow} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Outflow</span>
          <BreakdownAmount amount={-breakdown.outflow} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Savings alloc.</span>
          <BreakdownAmount amount={-breakdown.savingsAllocations} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Transfers</span>
          <BreakdownAmount amount={breakdown.transfers} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/20 pt-2">
        <span className="text-muted-foreground">Net movement</span>
        <BreakdownAmount amount={breakdown.movement} />
      </div>
      {account.type !== "debt" && breakdown.openingBalance < 0 ? (
        <div className="text-xs text-destructive">
          Negative opening balance on a non-debt account. Review whether this is intentional or
          legacy corrupted data.
        </div>
      ) : null}
    </div>
  );
}

export function getRepairRecommendation(
  account: Account,
  breakdown: AccountBalanceBreakdown,
) {
  if (account.type !== "debt" && breakdown.openingBalance < 0) {
    return 0;
  }

  return breakdown.openingBalance;
}
