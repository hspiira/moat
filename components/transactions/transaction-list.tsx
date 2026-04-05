"use client";

import type { Account, Category, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { transactionTypeLabels } from "./transaction-form";

/**
 * Format a numeric amount as Ugandan shillings without fractional digits.
 *
 * @param amount - The numeric amount to format in UGX
 * @returns The formatted currency string (locale "en-UG", currency "UGX", no fractional digits)
 */
function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  isSubmitting: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
};

/**
 * Render a card containing a list of recorded transactions or an empty-state when none exist.
 *
 * @param accounts - Available accounts used to display each transaction's account name
 * @param categories - Available categories used to display each transaction's category name
 * @param transactions - Transactions to render; transfer transactions are shown as individual records
 * @param isSubmitting - When true, disables action buttons to prevent concurrent submissions
 * @param onEdit - Callback invoked with a transaction when its Edit button is clicked
 * @param onDelete - Callback invoked with a transaction when its Delete button is clicked
 * @returns A JSX element containing the transactions card and its rows or an empty-state message
 */
export function TransactionList({
  accounts,
  categories,
  transactions,
  isSubmitting,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Recorded transactions</CardTitle>
        <CardDescription>
          Transfer pairs are shown as individual records. Non-transfer entries can be edited.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {transactions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          transactions.map((transaction) => {
            const account = accounts.find((a) => a.id === transaction.accountId);
            const category = categories.find((c) => c.id === transaction.categoryId);
            const isTransfer = transaction.type === "transfer";

            return (
              <div
                key={transaction.id}
                className="rounded-md border border-border/40 bg-muted/30 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCurrency(Math.abs(transaction.amount))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {transactionTypeLabels[transaction.type]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.occurredOn} · {account?.name ?? "—"} ·{" "}
                      {category?.name ?? "—"}
                    </div>
                    {transaction.note ? (
                      <div className="text-xs text-muted-foreground">{transaction.note}</div>
                    ) : null}
                  </div>
                  {!isTransfer ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onEdit(transaction)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={isSubmitting}
                        onClick={() => onDelete(transaction)}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={isSubmitting}
                      onClick={() => onDelete(transaction)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
