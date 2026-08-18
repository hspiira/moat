"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import {
  getAccountBalanceBreakdown,
  type AccountBalanceBreakdown,
} from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";
import { formatMoney } from "@/lib/currency";

function BreakdownAmount({
  amount,
  positiveNeutral = false,
}: {
  amount: number;
  /** A balance is a position, not a movement, so it carries no leading plus. */
  positiveNeutral?: boolean;
}) {
  return (
    <AmountIndicator
      tone={
        amount < 0 ? "negative" : amount > 0 && !positiveNeutral ? "positive" : "neutral"
      }
      sign={amount < 0 ? "negative" : amount > 0 && !positiveNeutral ? "positive" : "none"}
      value={formatMoney(Math.abs(amount))}
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
          Net change <BreakdownAmount amount={breakdown.movement} />
        </span>
        {account.type !== "debt" && breakdown.openingBalance < 0 ? (
          <span className="text-destructive">Check opening balance</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2 px-4 py-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">Opening</span>
          <BreakdownAmount amount={breakdown.openingBalance} positiveNeutral />
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">Current</span>
          <BreakdownAmount amount={breakdown.currentBalance} positiveNeutral />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["Inflow", breakdown.inflow],
            ["Outflow", -breakdown.outflow],
            ["Moved to savings", -breakdown.savingsAllocations],
            ["Transfers", breakdown.transfers],
          ] as const
        )
          .filter(([, amount]) => amount !== 0)
          .map(([label, amount]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <BreakdownAmount amount={amount} />
            </div>
          ))}
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="shrink-0 text-muted-foreground">Net movement</span>
        <BreakdownAmount amount={breakdown.movement} />
      </div>
      {account.type !== "debt" && breakdown.openingBalance < 0 ? (
        <div className="text-xs text-destructive">
          This account has a negative opening balance. Check that it&apos;s correct.
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
