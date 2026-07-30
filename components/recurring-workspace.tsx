"use client";

import { FeaturePageShell } from "@/components/feature-page-shell";

import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function RecurringWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <FeaturePageShell
      title="Recurring bills"
      description="Rent, school fees, and other obligations that repeat every month."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading recurring bills..."
      setupMessage="Complete onboarding and add at least one account before tracking recurring bills."
    >
      <RecurringObligationsPanel
        accounts={workspace.accounts}
        categories={workspace.categories}
        evaluations={workspace.recurringEvaluations}
        obligations={workspace.recurringObligations}
        today={new Date().toISOString().slice(0, 10)}
        isSubmitting={workspace.isSubmitting}
        onSaveObligation={(obligation) => void workspace.saveObligation(obligation)}
        onToggleObligation={(obligation) => void workspace.toggleObligation(obligation)}
      />
    </FeaturePageShell>
  );
}
