"use client";

import { useMemo } from "react";

import { BorrowingBand } from "@/components/accounts/borrowing-band";
import { DebtPayoffPlanner } from "@/components/accounts/debt-payoff-planner";
import { LendingBand } from "@/components/accounts/lending-band";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { EmptyStateCard } from "@/components/page-shell/page-state";
import { getBorrowingPortfolio } from "@/lib/domain/borrowing";
import { getDebtPortfolioSummary } from "@/lib/domain/debt";
import { getLendingPortfolio } from "@/lib/domain/lending";

import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function DebtWorkspace() {
  const workspace = useTransactionsWorkspace();
  const { accounts, transactions, counterparties } = workspace;
  const asOf = useMemo(() => new Date(), []);

  // Each panel already hides itself when its own side is empty. What the page
  // needs to know is whether all three are, which is the only case that should
  // render an explanation instead of a blank screen.
  const hasAnything = useMemo(
    () =>
      getDebtPortfolioSummary(accounts, transactions).length > 0 ||
      getLendingPortfolio(accounts, transactions, asOf, counterparties).borrowers.length > 0 ||
      getBorrowingPortfolio(accounts, transactions, asOf, counterparties).lenders.length > 0,
    [accounts, transactions, counterparties, asOf],
  );

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
      <DebtPayoffPlanner accounts={accounts} transactions={transactions} />

      <BorrowingBand
        accounts={accounts}
        transactions={transactions}
        counterparties={counterparties}
      />

      <LendingBand
        accounts={accounts}
        transactions={transactions}
        counterparties={counterparties}
      />

      {hasAnything ? null : (
        <EmptyStateCard
          title="Nothing owed in either direction"
          message="Record a transfer into 'Money lent out' when you lend someone money, or out of 'Money borrowed' when you borrow. Both accounts are already set up for you."
          href="/transactions"
          cta="Record a transaction"
        />
      )}
    </FeaturePageShell>
  );
}
