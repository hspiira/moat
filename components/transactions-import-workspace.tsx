"use client";

import { CsvImportPanel } from "./transactions/csv-import-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsImportWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      title="Import"
      description="Bring in transactions from a bank or mobile-money statement (CSV)."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
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
