"use client";

import { useMemo } from "react";

import { AmountIndicator } from "@/components/amount-indicator";
import { Button } from "@/components/ui/button";
import { useRecordTransaction } from "@/components/transactions/record-transaction-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { getLendingPortfolio, LENDING_POOL_ACCOUNT_ID, type BorrowerLoans } from "@/lib/domain/lending";
import type { Account, Counterparty, Transaction } from "@/lib/types";

/**
 * The most useful single fact about a loan, in falling order of urgency: an
 * overdue date, then an agreed date, then the most recent movement.
 */
function borrowerCaption(borrower: BorrowerLoans): string {
  if (borrower.expectedRepaymentDate) {
    const when = formatDate(borrower.expectedRepaymentDate);
    return borrower.isOverdue ? `Overdue since ${when}` : `Expected back ${when}`;
  }
  if (borrower.lastRepaymentOn) {
    return `Last repayment ${formatDate(borrower.lastRepaymentOn)}`;
  }
  if (borrower.lentOn) {
    return `Lent ${formatDate(borrower.lentOn)}`;
  }
  return "No activity yet";
}

function BorrowerRow({
  borrower,
  onRecordRepayment,
}: {
  borrower: BorrowerLoans;
  onRecordRepayment: (borrower: BorrowerLoans) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 gap-0.5">
        <span className="truncate font-medium text-foreground">{borrower.borrowerName}</span>
        <span
          className={
            borrower.isOverdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {borrower.isOverdue ? "⚠ " : ""}
          {borrowerCaption(borrower)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AmountIndicator
          tone={borrower.outstanding > 0 ? "negative" : "neutral"}
          sign="none"
          value={formatMoney(borrower.outstanding, "UGX")}
          className="text-sm font-medium"
        />
        {borrower.status === "outstanding" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRecordRepayment(borrower)}
          >
            Record repayment
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function LendingBand({
  accounts,
  transactions,
  counterparties,
}: {
  accounts: Account[];
  transactions: Transaction[];
  counterparties: Counterparty[];
}) {
  const record = useRecordTransaction();
  // One clock per mount keeps "overdue" stable across renders.
  const asOf = useMemo(() => new Date(), []);
  const portfolio = useMemo(
    () => getLendingPortfolio(accounts, transactions, asOf, counterparties),
    [accounts, transactions, asOf, counterparties],
  );

  if (portfolio.borrowers.length === 0) {
    return null;
  }

  const unsettled = portfolio.borrowers.filter(
    (borrower) => borrower.status === "outstanding" || borrower.status === "overpaid",
  );

  // Repayment is a transfer out of the receivable pool back into a real
  // account. The sheet opens pre-filled so nobody needs to know that.
  function openRepayment(borrower: BorrowerLoans) {
    record.open({
      type: "transfer",
      accountId: borrower.accountId ?? LENDING_POOL_ACCOUNT_ID,
      counterpartyId: borrower.counterpartyId ?? "",
      amount: borrower.outstanding > 0 ? String(borrower.outstanding) : "",
    });
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Owed to you</CardTitle>
        <CardDescription>
          Money you have lent out. Lending does not count as spending, and it does not
          change your net worth — the cash simply moved.
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
            <span className="text-xs text-muted-foreground">Lent</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalLent, "UGX")}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Repaid</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalRepaid, "UGX")}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Written off</span>
            <span className="text-lg font-semibold text-foreground">
              {formatMoney(portfolio.totalWrittenOff, "UGX")}
            </span>
          </div>
        </div>

        <div className="grid">
          {unsettled.length > 0 ? (
            unsettled.map((borrower) => (
              <BorrowerRow
                key={borrower.borrowerKey}
                borrower={borrower}
                onRecordRepayment={openRepayment}
              />
            ))
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              Everyone has settled up.
            </p>
          )}
        </div>
      </CardContent>
      {record.sheet}
    </Card>
  );
}
