"use client";

import { CaptureReviewQueue } from "./transactions/capture-review-queue";
import { CaptureReviewSectionLinks } from "./transactions/capture-review-section-links";
import { useCaptureReviewWorkspace } from "./transactions/use-capture-review-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsCaptureReviewWorkspace() {
  const workspace = useCaptureReviewWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="review"
      title="Capture review"
      description="Resolve captured items before they reach the ledger."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.openCaptureReviewItems.length}
      duplicateCount={workspace.captureReviewItems.filter((item) => item.status === "duplicate").length}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5">
        <CaptureReviewSectionLinks current="capture" />
        <CaptureReviewQueue
          accounts={workspace.accounts}
          categories={workspace.categories}
          items={workspace.captureReviewItems}
          isSubmitting={workspace.isSubmitting}
          onApprove={workspace.approveItem}
          onReject={workspace.rejectItem}
          onMarkDuplicate={workspace.markDuplicate}
          onUpdateItem={workspace.updateItem}
        />
      </div>
    </TransactionsWorkspaceFrame>
  );
}
