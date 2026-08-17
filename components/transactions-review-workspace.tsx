"use client";

import { useState } from "react";

import { MonthClosePanel } from "./transactions/month-close-panel";
import { CaptureReviewSectionLinks } from "./transactions/capture-review-section-links";
import { TransactionDetailSheet } from "./transactions/transaction-detail-sheet";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsReviewWorkspace() {
  const workspace = useTransactionsWorkspace();
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  // Resolved from the live list so a deleted transaction closes the sheet
  // instead of stranding a stale copy in it.
  const detailTransaction =
    workspace.transactions.find((transaction) => transaction.id === detailTransactionId) ?? null;

  return (
    <TransactionsWorkspaceFrame
      title="Month check"
      description="Make sure this month is complete, so its totals can be trusted."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
    >
      {/* A fragment, not another grid: the frame already wraps children in a
          gap-5 grid, so nesting an identical one only added a DOM layer. */}
      <>
        <CaptureReviewSectionLinks current="month-close" />

        <MonthClosePanel
          period={workspace.closePeriod}
          monthClose={workspace.monthClose}
          evaluation={workspace.monthCloseEvaluation}
          recurringEvaluations={workspace.recurringEvaluations}
          accounts={workspace.accounts}
          isSubmitting={workspace.isSubmitting}
          onExport={workspace.exportMonthClose}
          onClose={() => void workspace.closeMonth()}
          onOpenTransaction={(transaction) => setDetailTransactionId(transaction.id)}
        />

        <TransactionDetailSheet
          transaction={detailTransaction}
          transactions={workspace.transactions}
          accounts={workspace.accounts}
          categories={workspace.categories}
          lineItems={workspace.lineItems}
          isSubmitting={workspace.isSubmitting}
          onOpenChange={(open) => (open ? undefined : setDetailTransactionId(null))}
          onSaveLineItem={(input) => void workspace.saveLineItem(input)}
          onDeleteLineItem={(lineItem) => void workspace.deleteLineItem(lineItem)}
        />
      </>
    </TransactionsWorkspaceFrame>
  );
}
