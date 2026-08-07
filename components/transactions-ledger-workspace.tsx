"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch, IconX } from "@tabler/icons-react";

import { searchTransactions } from "@/lib/domain/transaction-search";

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
  const [query, setQuery] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  const visibleTransactions = useMemo(
    () =>
      searchTransactions(workspace.transactions, query, workspace.accounts, workspace.categories),
    [workspace.transactions, query, workspace.accounts, workspace.categories],
  );

  const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / LEDGER_PAGE_SIZE));
  // Clamp rather than reset so deletes on the last page don't strand the view.
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * LEDGER_PAGE_SIZE;
  const pageTransactions = visibleTransactions.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);
  const isEditing = Boolean(workspace.editingTransactionId);
  // Resolved from the live list so a deleted transaction closes the sheet
  // instead of stranding a stale copy in it.
  const detailTransaction =
    workspace.transactions.find((transaction) => transaction.id === detailTransactionId) ?? null;

  return (
    <TransactionsWorkspaceFrame
      currentRoute="ledger"
      title="Transactions"
      srOnlyTitle
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
          <Card className="bg-muted/20 shadow-none">
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
          <Card className="bg-muted/20 shadow-none">
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

        <div className="relative">
          <IconSearch
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search payee, category, note, or amount"
            aria-label="Search transactions"
            className="h-11 w-full rounded-lg bg-muted/50 pr-10 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="size-4" />
            </button>
          ) : null}
        </div>

        {query && visibleTransactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions match &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : null}
        {query && visibleTransactions.length > 0 ? (
          <p className="text-xs text-muted-foreground" role="status">
            {visibleTransactions.length}{" "}
            {visibleTransactions.length === 1 ? "match" : "matches"}
          </p>
        ) : null}

        <TransactionList
          accounts={workspace.accounts}
          categories={workspace.categories}
          transactions={pageTransactions}
          pendingSyncIds={workspace.pendingSyncTransactionIds}
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
              {pageStart + 1}–{Math.min(pageStart + LEDGER_PAGE_SIZE, visibleTransactions.length)}{" "}
              of {visibleTransactions.length}
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
        lineItems={workspace.lineItems}
        isSubmitting={workspace.isSubmitting}
        onOpenChange={(open) => (open ? undefined : setDetailTransactionId(null))}
        onSaveLineItem={(input) => void workspace.saveLineItem(input)}
        onDeleteLineItem={(lineItem) => void workspace.deleteLineItem(lineItem)}
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
