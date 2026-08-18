"use client";

import { useMemo } from "react";

import {
  BORROWING_BAND_COPY,
  LENDING_BAND_COPY,
  PartyBand,
} from "@/components/accounts/party-band";
import { DebtPayoffPlanner } from "@/components/accounts/debt-payoff-planner";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { useRecordTransaction } from "@/components/transactions/record-transaction-sheet";
import { EmptyStateCard } from "@/components/page-shell/page-state";
import { getBorrowingPortfolio } from "@/lib/domain/borrowing";
import { getDebtPortfolioSummary } from "@/lib/domain/debt";
import { getLendingPortfolio } from "@/lib/domain/lending";

import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function DebtWorkspace() {
  const record = useRecordTransaction();
  const workspace = useTransactionsWorkspace();
  const { accounts, transactions, counterparties } = workspace;

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

  return (
    <FeaturePageShell
      title="Money owed"
      srOnlyTitle
      description="What you owe, and what is owed to you."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading what you owe and what you are owed..."
      setupMessage="Complete onboarding and add at least one account before tracking what is owed."
    >
      <DebtPayoffPlanner accounts={accounts} transactions={transactions} />

      <PartyBand portfolio={borrowing} copy={BORROWING_BAND_COPY} />
      <PartyBand portfolio={lending} copy={LENDING_BAND_COPY} />

      {hasAnything ? null : (
        <EmptyStateCard
          title="Nothing owed in either direction"
          message="Record a transfer into 'Money lent out' when you lend someone money, or out of 'Money borrowed' when you borrow. Both accounts are already set up for you."
          cta="Record a transaction"
          onAction={record.open}
        />
      )}
      {record.sheet}
    </FeaturePageShell>
  );
}
