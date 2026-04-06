"use client";

import { MonthClosePanel } from "./transactions/month-close-panel";
import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsReviewWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="review"
      title="Review"
      description="Resolve duplicates, recurring obligations, and month-close issues away from the main ledger."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <MonthClosePanel
          period={workspace.closePeriod}
          monthClose={workspace.monthClose}
          evaluation={workspace.monthCloseEvaluation}
          recurringEvaluations={workspace.recurringEvaluations}
          isSubmitting={workspace.isSubmitting}
          onRefresh={() => {
            if (workspace.profile) {
              void workspace.refreshMonthCloseState(workspace.profile.id);
            }
          }}
          onClose={() => void workspace.closeMonth()}
          onExport={workspace.exportMonthClose}
        />

        <RecurringObligationsPanel
          accounts={workspace.accounts}
          categories={workspace.categories}
          evaluations={workspace.recurringEvaluations}
          isSubmitting={workspace.isSubmitting}
          onSaveObligation={(obligation) => void workspace.saveObligation(obligation)}
          onToggleObligation={(obligation) => void workspace.toggleObligation(obligation)}
        />
      </div>
    </TransactionsWorkspaceFrame>
  );
}
