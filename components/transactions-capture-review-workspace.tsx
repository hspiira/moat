"use client";

import { CaptureReviewQueue } from "./transactions/capture-review-queue";
import { CaptureReviewSectionLinks } from "./transactions/capture-review-section-links";
import { useCaptureReviewWorkspace } from "./transactions/use-capture-review-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsCaptureReviewWorkspace() {
  const workspace = useCaptureReviewWorkspace();

  return (
    <TransactionsWorkspaceFrame
      title="Capture review"
      description="Resolve captured items before they reach the ledger."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
    >
      {/* A fragment, not another grid: the frame already wraps children in a
          gap-5 grid, so nesting an identical one only added a DOM layer. */}
      <>
        <CaptureReviewSectionLinks current="capture" />
        <CaptureReviewQueue
          accounts={workspace.accounts}
          categories={workspace.categories}
          items={workspace.captureReviewItems}
          transactions={workspace.transactions}
          isSubmitting={workspace.isSubmitting}
          onApprove={workspace.approveItem}
          onReject={workspace.rejectItem}
          onMarkDuplicate={workspace.markDuplicate}
          onClearDuplicate={workspace.clearDuplicate}
          onUpdateItem={workspace.updateItem}
        />
      </>
    </TransactionsWorkspaceFrame>
  );
}
