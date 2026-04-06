"use client";

import { CaptureIntentPanel } from "./transactions/capture-intent-panel";
import { TextCapturePanel } from "./transactions/text-capture-panel";
import { TransactionForm } from "./transactions/transaction-form";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsCaptureWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="capture"
      title="Capture"
      description="Manual entry and pasted text intake stay here so the main ledger stays clean."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5">
        <CaptureIntentPanel intent={workspace.captureIntent} />

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <TransactionForm
            accounts={workspace.accounts}
            categories={workspace.categories}
            form={workspace.transactionForm}
            editingId={workspace.editingTransactionId}
            isSubmitting={workspace.isSubmitting}
            lastSavedAt={workspace.lastSavedAt}
            successMessage={workspace.successMessage}
            rememberedFxHint={workspace.rememberedFxHint}
            onFormChange={workspace.setTransactionForm}
            onSubmit={(event) => void workspace.handleTransactionSubmit(event)}
            onCancelEdit={workspace.cancelEdit}
          />

          <TextCapturePanel
            accounts={workspace.accounts}
            categories={workspace.categories}
            existingTransactions={workspace.transactions}
            isSubmitting={workspace.isSubmitting}
            active={workspace.captureIntent === "text"}
            initialInput={workspace.sharedCaptureInput}
            onSaveCaptured={workspace.saveCapturedTransactions}
          />
        </div>
      </div>
    </TransactionsWorkspaceFrame>
  );
}
