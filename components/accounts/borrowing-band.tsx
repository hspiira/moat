"use client";

import { useMemo } from "react";

import { AmountIndicator } from "@/components/amount-indicator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { getBorrowingPortfolio, type LenderLoans } from "@/lib/domain/borrowing";
import type { Account, Counterparty, Transaction } from "@/lib/types";

function lenderCaption(lender: LenderLoans): string {
  if (lender.expectedRepaymentDate) {
    const when = formatDate(lender.expectedRepaymentDate);
    return lender.isOverdue ? `Overdue since ${when}` : `Agreed to repay by ${when}`;
  }
  if (lender.lastRepaymentOn) {
    return `Last payment ${formatDate(lender.lastRepaymentOn)}`;
  }
  if (lender.borrowedOn) {
    return `Borrowed ${formatDate(lender.borrowedOn)}`;
  }
  return "No activity yet";
}

function LenderRow({ lender }: { lender: LenderLoans }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/20 py-3 last:border-b-0">
      <div className="grid gap-0.5">
        <span className="font-medium text-foreground">{lender.lenderName}</span>
        <span
          className={
            lender.isOverdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {lender.isOverdue ? "⚠ " : ""}
          {lenderCaption(lender)}
        </span>
      </div>
      <AmountIndicator
        tone={lender.outstanding > 0 ? "negative" : "neutral"}
        sign="none"
        value={formatMoney(lender.outstanding, "UGX")}
        className="text-sm font-medium"
      />
    </div>
  );
}

export function BorrowingBand({
  accounts,
  transactions,
  counterparties,
}: {
  accounts: Account[];
  transactions: Transaction[];
  counterparties: Counterparty[];
}) {
  // One clock per mount keeps "overdue" stable across renders.
  const asOf = useMemo(() => new Date(), []);
  const portfolio = useMemo(
    () => getBorrowingPortfolio(accounts, transactions, asOf, counterparties),
    [accounts, transactions, asOf, counterparties],
  );

  if (portfolio.lenders.length === 0) {
    return null;
  }

  const unsettled = portfolio.lenders.filter(
    (lender) => lender.status === "outstanding" || lender.status === "overpaid",
  );

  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle>You owe</CardTitle>
        <CardDescription>
          Money borrowed from people rather than institutions. There is no interest and no
          schedule here — Moat only shows a date when you have agreed to one.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Still owed</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalOutstanding, "UGX")}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Borrowed</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalBorrowed, "UGX")}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Repaid</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalRepaid, "UGX")}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Forgiven</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalForgiven, "UGX")}
            </span>
          </div>
        </div>

        <div className="grid">
          {unsettled.length > 0 ? (
            unsettled.map((lender) => <LenderRow key={lender.lenderKey} lender={lender} />)
          ) : (
            <p className="py-3 text-sm text-muted-foreground">You have settled up with everyone.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
