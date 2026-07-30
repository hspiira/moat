"use client";

import { useMemo } from "react";

import { DebtPayoffPlanner } from "@/components/accounts/debt-payoff-planner";
import { LendingBand } from "@/components/accounts/lending-band";
import { FeaturePageShell } from "@/components/feature-page-shell";
import { EmptyStateCard } from "@/components/page-shell/page-state";
import { getDebtSummary } from "@/lib/domain/debt";

import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function DebtWorkspace() {
  const workspace = useTransactionsWorkspace();
  const { accounts, transactions } = workspace;

  const hasDebt = useMemo(
    () => accounts.some((account) => getDebtSummary(account, transactions) !== null),
    [accounts, transactions],
  );
  const hasReceivables = useMemo(
    () => accounts.some((account) => account.type === "receivable" && !account.isArchived),
    [accounts],
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
      {/* Both panels return null when their side is empty, which is right when
          they sit among other panels. On this route that would be a blank
          screen, so the doubly-empty case gets an explanation and the action
          that resolves it. */}
      {hasDebt ? (
        <DebtPayoffPlanner accounts={accounts} transactions={transactions} />
      ) : null}

      <LendingBand accounts={accounts} transactions={transactions} />

      {/* Only genuinely empty when neither direction has anything in it. */}
      {hasDebt || hasReceivables ? null : (
        <EmptyStateCard
          title="Nothing owed in either direction"
          message="Add a debt account for money you owe, or a 'Money lent out' account for money someone owes you."
          href="/accounts"
          cta="Go to accounts"
        />
      )}
    </FeaturePageShell>
  );
}
