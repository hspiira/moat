"use client";

import {
  IconArrowDownRight,
  IconArrowsExchange,
  IconArrowUpRight,
  IconClock,
  IconPigMoney,
  IconReceipt2,
} from "@tabler/icons-react";

import { Money } from "@/components/ui/money";
import { counterpartiesById, partyNameFor } from "@/lib/domain/party-name";
import type { Account, Category, Counterparty, Transaction, TransactionType } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDayHeading } from "@/lib/format-date";
import { transactionTypeLabels } from "./transaction-form";
import { transferLegs } from "@/lib/domain/transaction-cascade";

type Props = {
  accounts: Account[];
  categories: Category[];
  counterparties?: Counterparty[];
  partyByGroup?: Map<string, string>;
  transactions: Transaction[];
  pendingSyncIds?: Set<string>;
  onOpenDetail: (transaction: Transaction) => void;
};

type RowPresentation = {
  icon: typeof IconArrowUpRight;
  iconClass: string;
  tone: "positive" | "negative" | "neutral";
  signed: boolean;
};

const presentationByType: Record<TransactionType, RowPresentation> = {
  income: { icon: IconArrowUpRight, iconClass: "bg-pos/12 text-pos", tone: "positive", signed: true },
  expense: { icon: IconArrowDownRight, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
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
    signed: true,
  },
};

function groupByDay(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const bucket = groups.get(transaction.occurredOn) ?? [];
    bucket.push(transaction);
    groups.set(transaction.occurredOn, bucket);
  }
  return [...groups.entries()];
}

export function TransactionList({
  accounts,
  categories,
  counterparties = [],
  partyByGroup,
  transactions,
  pendingSyncIds,
  onOpenDetail,
}: Props) {
  const partyById = counterpartiesById(counterparties);
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
          <div className="grid gap-4">
            {groupByDay(transactions).map(([day, dayTransactions]) => (
              <section key={day} className="min-w-0">
                <h2 className="px-4 pb-1 text-xs font-medium text-muted-foreground">
                  {formatDayHeading(day)}
                </h2>
                <ul className="divide-y divide-border/50">
                  {dayTransactions.map((transaction) => {
              const account = accounts.find((a) => a.id === transaction.accountId);
              const category = categories.find((c) => c.id === transaction.categoryId);
              const isTransfer = transaction.type === "transfer";
              const legs = isTransfer ? transferLegs(transaction, transactions) : null;
              const route = legs
                ? `${accounts.find((a) => a.id === legs.source.accountId)?.name ?? "Unknown"} → ${
                    accounts.find((a) => a.id === legs.destination.accountId)?.name ?? "Unknown"
                  }`
                : null;
              const isLinkedFee = Boolean(transaction.feeParentId);
              const presentation = presentationByType[transaction.type];
              const Icon = presentation.icon;
              const title =
                partyNameFor(transaction, partyById, partyByGroup) ??
                category?.name ??
                transactionTypeLabels[transaction.type];

              return (
                <li key={transaction.id} className="transition-colors hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(transaction)}
                    className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`Details for ${title}`}
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
                        {route ?? account?.name ?? "—"}
                        {category && !isTransfer ? ` · ${category.name}` : ""}
                        {transaction.currency !== "UGX" ? ` · ${transaction.currency}` : ""}
                        {isLinkedFee ? " · Fee" : ""}
                      </div>
                    </div>

                    <span className="flex shrink-0 items-center gap-1.5">
                      {pendingSyncIds?.has(transaction.id) ? (
                        <IconClock
                          aria-hidden
                          className="size-3.5 text-muted-foreground"
                          title="Waiting to sync"
                        />
                      ) : null}
                      <Money
                        amount={transaction.amount}
                        currency="UGX"
                        symbol="short"
                        tone={presentation.tone}
                        signed={presentation.signed}
                        className="text-sm font-semibold tabular-nums sm:text-base"
                      />
                      {pendingSyncIds?.has(transaction.id) ? (
                        <span className="sr-only">Waiting to sync</span>
                      ) : null}
                    </span>
                  </button>

                </li>
              );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
