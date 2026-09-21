"use client";

import { useMemo } from "react";
import { IconChevronRight } from "@tabler/icons-react";

import {
  BORROWING_BAND_COPY,
  LENDING_BAND_COPY,
  PartyBand,
} from "@/components/accounts/party-band";
import { DebtPayoffPlanner } from "@/components/accounts/debt-payoff-planner";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { useRecordTransaction } from "@/components/transactions/record-transaction-sheet";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/page-shell/page-state";
import { borrowingPoolAccountId, getBorrowingPortfolio } from "@/lib/domain/borrowing";
import { getDebtPortfolioSummary } from "@/lib/domain/debt";
import { getLendingPortfolio, lendingPoolAccountId } from "@/lib/domain/lending";

import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function DebtWorkspace() {
  const record = useRecordTransaction();
  const workspace = useTransactionsWorkspace();
  const { accounts, transactions, counterparties, profile } = workspace;

  const { lending, borrowing, formalDebts } = useMemo(() => {
    const asOf = new Date();
    return {
      lending: getLendingPortfolio(accounts, transactions, asOf, counterparties),
      borrowing: getBorrowingPortfolio(accounts, transactions, asOf, counterparties),
      formalDebts: getDebtPortfolioSummary(accounts, transactions),
    };
  }, [accounts, transactions, counterparties]);

  const hasAnything =
    formalDebts.length > 0 || lending.parties.length > 0 || borrowing.parties.length > 0;

  // Lending moves money into a receivable; borrowing draws it out of a debt.
  // Both are transfers, and asking the reader to work that out was what the
  // old empty state did.
  function recordLent() {
    if (!profile) return;
    record.open({ type: "transfer", destinationAccountId: lendingPoolAccountId(profile.id) });
  }

  function recordBorrowed() {
    if (!profile) return;
    record.open({ type: "transfer", accountId: borrowingPoolAccountId(profile.id) });
  }

  return (
    <FeaturePageShell
      title="Money owed"
      description="What you owe, and what is owed to you."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading what you owe and what you are owed..."
      setupMessage="Complete onboarding and add at least one account before tracking what is owed."
    >
      {/* Who owes what comes first. Planning a payoff is a tool you reach for
          once you have seen the debts, not a preamble to reading them. */}
      <PartyBand portfolio={borrowing} copy={BORROWING_BAND_COPY} />
      <PartyBand portfolio={lending} copy={LENDING_BAND_COPY} />

      {hasAnything ? (
        <details className="group/payoff grid gap-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <IconChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open/payoff:rotate-90"
            />
            Plan a payoff
          </summary>
          <DebtPayoffPlanner accounts={accounts} transactions={transactions} />
        </details>
      ) : (
        <EmptyStateCard
          title="Nothing owed in either direction"
          message="Record it here and the right accounts are filled in for you."
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={recordLent}>
              Record money lent
            </Button>
            <Button type="button" variant="outline" onClick={recordBorrowed}>
              Record money borrowed
            </Button>
          </div>
        </EmptyStateCard>
      )}
      {record.sheet}
    </FeaturePageShell>
  );
}
