"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { TransactionForm } from "./transactions/transaction-form";
import { TransactionList } from "./transactions/transaction-list";
import { TransactionDetailSheet } from "./transactions/transaction-detail-sheet";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

const LEDGER_PAGE_SIZE = 25;

export function TransactionsLedgerWorkspace() {
  const workspace = useTransactionsWorkspace();
  const [page, setPage] = useState(0);
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(workspace.transactions.length / LEDGER_PAGE_SIZE));
  // Clamp rather than reset so deletes on the last page don't strand the view.
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * LEDGER_PAGE_SIZE;
  const pageTransactions = workspace.transactions.slice(
    pageStart,
    pageStart + LEDGER_PAGE_SIZE,
  );
  const isEditing = Boolean(workspace.editingTransactionId);
  // Resolved from the live list so a deleted transaction closes the sheet
  // instead of stranding a stale copy in it.
  const detailTransaction =
    workspace.transactions.find((transaction) => transaction.id === detailTransactionId) ?? null;

  return (
    <TransactionsWorkspaceFrame
      currentRoute="ledger"
      title="Transactions"
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
      <div className="grid gap-5">
        {/* Two separate queues, so one sentence each rather than three counts
            summed into a number that matched neither. Captured items lead when
            present: that is the queue that grows on its own. */}
        {workspace.captureReviewCount > 0 ? (
          <Card className="border-border/20 bg-muted/20 shadow-none">
            <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {workspace.captureReviewCount} captured{" "}
                {workspace.captureReviewCount === 1 ? "item is" : "items are"} waiting for review.
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/transactions/review">Open inbox</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {workspace.reviewCount > 0 || workspace.duplicateCount > 0 ? (
          <Card className="border-border/20 bg-muted/20 shadow-none">
            <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {[
                  workspace.reviewCount > 0 ? `${workspace.reviewCount} unposted` : null,
                  workspace.duplicateCount > 0
                    ? `${workspace.duplicateCount} possibly duplicated`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" and ")}{" "}
                in this month.
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/transactions/review/month-close">Month close</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <TransactionList
          accounts={workspace.accounts}
          categories={workspace.categories}
          transactions={pageTransactions}
          isSubmitting={workspace.isSubmitting}
          onEdit={workspace.beginTransactionEdit}
          onDelete={(transaction) => void workspace.handleDeleteTransaction(transaction)}
          onOpenDetail={(transaction) => setDetailTransactionId(transaction.id)}
        />

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {pageStart + 1}–{Math.min(pageStart + LEDGER_PAGE_SIZE, workspace.transactions.length)}{" "}
              of {workspace.transactions.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <TransactionDetailSheet
        transaction={detailTransaction}
        transactions={workspace.transactions}
        accounts={workspace.accounts}
        categories={workspace.categories}
        onOpenChange={(open) => (open ? undefined : setDetailTransactionId(null))}
      />

      <Sheet open={isEditing} onOpenChange={(open) => (open ? undefined : workspace.cancelEdit())}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="sr-only">
            <SheetTitle>Edit transaction</SheetTitle>
            <SheetDescription>Update the selected transaction and save.</SheetDescription>
          </SheetHeader>
          {isEditing ? (
            <div className="pt-2">
              <TransactionForm
                embedded
                accounts={workspace.accounts}
                categories={workspace.categories}
                counterparties={workspace.counterparties}
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
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </TransactionsWorkspaceFrame>
  );
}
