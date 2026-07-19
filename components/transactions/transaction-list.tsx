"use client";

import {
  IconArrowDownLeft,
  IconArrowsExchange,
  IconArrowUpRight,
  IconPencil,
  IconPigMoney,
  IconReceipt2,
  IconTrash,
} from "@tabler/icons-react";

import { Money } from "@/components/ui/money";
import type { Account, Category, Transaction, TransactionType } from "@/lib/types";
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

type RowPresentation = {
  icon: typeof IconArrowDownLeft;
  iconClass: string;
  tone: "positive" | "negative" | "neutral";
  signed: boolean;
};

const presentationByType: Record<TransactionType, RowPresentation> = {
  income: { icon: IconArrowDownLeft, iconClass: "bg-pos/12 text-pos", tone: "positive", signed: true },
  expense: { icon: IconArrowUpRight, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  debt_payment: { icon: IconReceipt2, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  savings_contribution: {
    icon: IconPigMoney,
    iconClass: "bg-pos/12 text-pos",
    tone: "positive",
    signed: false,
  },
  transfer: {
    icon: IconArrowsExchange,
    iconClass: "bg-muted text-muted-foreground",
    tone: "neutral",
    signed: false,
  },
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-UG", { day: "numeric", month: "short" });
}

export function TransactionList({
  accounts,
  categories,
  transactions,
  isSubmitting,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger</CardTitle>
        <CardDescription>Posted movements first. Transfers appear as paired records.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {transactions.length === 0 ? (
          <div className="px-4">
            <EmptyState>No transactions yet.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {transactions.map((transaction) => {
              const account = accounts.find((a) => a.id === transaction.accountId);
              const category = categories.find((c) => c.id === transaction.categoryId);
              const isTransfer = transaction.type === "transfer";
              const presentation = presentationByType[transaction.type];
              const Icon = presentation.icon;
              const title =
                transaction.payee ??
                transaction.rawPayee ??
                category?.name ??
                transactionTypeLabels[transaction.type];

              return (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${presentation.iconClass}`}
                  >
                    <Icon className="size-4.5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{title}</span>
                      <span className="shrink-0 text-[0.65rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        {transactionTypeLabels[transaction.type]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(transaction.occurredOn)} · {account?.name ?? "—"}
                      {category && !isTransfer ? ` · ${category.name}` : ""}
                      {transaction.currency !== "UGX" ? ` · ${transaction.currency}` : ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Money
                      amount={transaction.amount}
                      currency="UGX"
                      tone={presentation.tone}
                      signed={presentation.signed}
                      className="text-sm font-semibold sm:text-base"
                    />
                    <div className="flex">
                      {!isTransfer ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${title}`}
                          onClick={() => onEdit(transaction)}
                        >
                          <IconPencil />
                        </Button>
                      ) : null}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${title}`}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={isSubmitting}
                        onClick={() => onDelete(transaction)}
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
