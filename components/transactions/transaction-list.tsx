"use client";

import {
  IconArrowDownLeft,
  IconArrowsExchange,
  IconArrowUpRight,
  IconDotsVertical,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirmDelete } from "@/components/hooks/use-confirm-delete";
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
  const del = useConfirmDelete(onDelete);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger</CardTitle>
        <CardDescription>Newest first. Transfers show as a matched pair.</CardDescription>
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
                    <div className="truncate text-sm font-medium text-foreground">{title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(transaction.occurredOn)} · {account?.name ?? "—"}
                      {category && !isTransfer ? ` · ${category.name}` : ""}
                      {transaction.currency !== "UGX" ? ` · ${transaction.currency}` : ""}
                    </div>
                  </div>

                  <Money
                    amount={transaction.amount}
                    currency="UGX"
                    tone={presentation.tone}
                    signed={presentation.signed}
                    className="shrink-0 text-sm font-semibold sm:text-base"
                  />

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0 text-muted-foreground"
                        aria-label={`Actions for ${title}`}
                        disabled={isSubmitting}
                      >
                        <IconDotsVertical />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-40 p-1">
                      {!isTransfer ? (
                        <PopoverClose asChild>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => onEdit(transaction)}
                          >
                            <IconPencil className="size-4" /> Edit
                          </button>
                        </PopoverClose>
                      ) : null}
                      <PopoverClose asChild>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                          onClick={() => del.request(transaction, title)}
                        >
                          <IconTrash className="size-4" /> Delete
                        </button>
                      </PopoverClose>
                    </PopoverContent>
                  </Popover>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        {...del.dialogProps}
        title="Delete this transaction?"
        description={
          <>
            <span className="font-medium text-foreground">{del.label}</span>{" "}
            will be permanently removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </Card>
  );
}
