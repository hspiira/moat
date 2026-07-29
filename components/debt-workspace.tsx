"use client";

import { useMemo } from "react";

import { DebtPayoffPlanner } from "@/components/accounts/debt-payoff-planner";
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

  return (
    <FeaturePageShell
      title="Debt payoff"
      description="Choose a payoff order and see when each balance clears."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading debt accounts..."
      setupMessage="Complete onboarding and add at least one account before planning a payoff."
    >
      {/* The planner itself returns null without debt accounts, which is right
          when it is one panel among many on the accounts page. On its own route
          that would be a blank screen, so the empty case gets an explanation
          and the action that resolves it. */}
      {hasDebt ? (
        <DebtPayoffPlanner accounts={accounts} transactions={transactions} />
      ) : (
        <EmptyStateCard
          title="No debt accounts yet"
          message="Add an account with a debt type — a loan, SACCO borrowing, or a credit balance — and the payoff plan appears here."
          href="/accounts"
          cta="Go to accounts"
        />
      )}
    </FeaturePageShell>
  );
}
