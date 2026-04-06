"use client";

import { formatMoney } from "@/lib/currency";
import { AmountIndicator } from "@/components/amount-indicator";
import type { Account, Category, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { transactionTypeLabels } from "./transaction-form";

type Props = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  isSubmitting: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
};

export function TransactionList({
  accounts,
  categories,
  transactions,
  isSubmitting,
  onEdit,
  onDelete,
}: Props) {
  function getTransactionTone(transaction: Transaction) {
    if (transaction.type === "income") {
      return { tone: "positive" as const, sign: "positive" as const };
    }
    if (transaction.type === "transfer") {
      return { tone: "neutral" as const, sign: "none" as const, direction: "transfer" as const };
    }
    return { tone: "negative" as const, sign: "negative" as const };
  }

  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <CardDescription>Transfers appear as paired records.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {transactions.length === 0 ? (
          <EmptyState>No transactions yet.</EmptyState>
        ) : (
          transactions.map((transaction, index) => {
            const account = accounts.find((a) => a.id === transaction.accountId);
            const category = categories.find((c) => c.id === transaction.categoryId);
            const isTransfer = transaction.type === "transfer";
            const presentation = getTransactionTone(transaction);

            return (
              <div
                key={transaction.id}
                className={`border px-3 py-3 ${
                  index === 0
                    ? "moat-panel-mint border-border/20"
                    : index % 2 === 0
                      ? "moat-panel-sage border-border/20"
                      : "bg-muted/20 border-border/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <AmountIndicator
                        tone={presentation.tone}
                        sign={presentation.sign}
                        direction={presentation.direction}
                        showIcon={transaction.type === "transfer"}
                        value={formatMoney(Math.abs(transaction.amount), "UGX")}
                        className="text-base font-semibold"
                      />
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {transactionTypeLabels[transaction.type]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.occurredOn} · {account?.name ?? "—"} ·{" "}
                      {category?.name ?? "—"}
                    </div>
                    {transaction.payee || transaction.rawPayee ? (
                      <div className="text-xs text-muted-foreground">
                        {transaction.payee ?? transaction.rawPayee}
                        {transaction.source ? ` · ${transaction.source}` : ""}
                        {transaction.reconciliationState
                          ? ` · ${transaction.reconciliationState}`
                          : ""}
                      </div>
                    ) : null}
                    {transaction.currency !== "UGX" ? (
                      <div className="text-xs text-muted-foreground">
                        Source amount {formatMoney(transaction.originalAmount, transaction.currency)}
                        {transaction.fxRateToUgx
                          ? ` · FX ${transaction.fxRateToUgx.toLocaleString("en-UG")}`
                          : ""}
                      </div>
                    ) : null}
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
