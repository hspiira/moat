"use client";

import { CorrectionLogPanel } from "./transactions/correction-log-panel";
import { TransactionRulesPanel } from "./transactions/transaction-rules-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsToolsWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="tools"
      title="Rules & corrections"
      description="Auto-fill rules and the parser correction log."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount}
      captureInboxCount={workspace.captureReviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TransactionRulesPanel
          accounts={workspace.accounts}
          categories={workspace.categories}
          rules={workspace.transactionRules}
          isSubmitting={workspace.isSubmitting}
          onSaveRule={(rule) => void workspace.saveRule(rule)}
          onToggleRule={(rule) => void workspace.toggleRule(rule)}
        />


        <CorrectionLogPanel profile={workspace.profile} />
      </div>
    </TransactionsWorkspaceFrame>
  );
}
