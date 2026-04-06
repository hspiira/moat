"use client";

import { CsvImportPanel } from "./transactions/csv-import-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsImportWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="import"
      title="Import"
      description="Statement imports live on their own route so mapping and review do not crowd the ledger."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount + workspace.captureReviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <CsvImportPanel
        accounts={workspace.accounts}
        categories={workspace.categories}
        transactions={workspace.transactions}
        profile={workspace.profile!}
        onImportSuccess={() => void workspace.loadWorkspace()}
        onError={workspace.setError}
      />
    </TransactionsWorkspaceFrame>
  );
}
