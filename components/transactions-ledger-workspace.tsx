"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { TransactionList } from "./transactions/transaction-list";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

export function TransactionsLedgerWorkspace() {
  const workspace = useTransactionsWorkspace();

  return (
    <TransactionsWorkspaceFrame
      currentRoute="ledger"
      title="Transactions"
      description="Posted movements first. Capture, import, and review each have their own route."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount + workspace.captureReviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5">
        {(workspace.reviewCount > 0 || workspace.captureReviewCount > 0 || workspace.duplicateCount > 0) && (
          <Card className="border-border/20 bg-muted/20 shadow-none">
            <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {workspace.reviewCount} transaction item(s), {workspace.captureReviewCount} captured item(s), and {workspace.duplicateCount} duplicate group(s) need attention.
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/transactions/review">Open review</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <TransactionList
          accounts={workspace.accounts}
          categories={workspace.categories}
          transactions={workspace.transactions}
          isSubmitting={workspace.isSubmitting}
          onEdit={workspace.beginTransactionEdit}
          onDelete={(transaction) => void workspace.handleDeleteTransaction(transaction)}
        />
      </div>
    </TransactionsWorkspaceFrame>
  );
}
