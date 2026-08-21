"use client";

import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { counterpartiesById, partyNameFor } from "@/lib/domain/party-name";
import { formatDayHeading } from "@/lib/format-date";
import { transactionTypeLabels } from "@/lib/select-options";
import type { Category, Counterparty, Transaction } from "@/lib/types";

export function DayTransactions({
  date,
  transactions,
  categories,
  counterparties = [],
}: {
  date: string;
  transactions: Transaction[];
  categories: Category[];
  counterparties?: Counterparty[];
}) {
  const partyById = counterpartiesById(counterparties);

  return (
    <div className="grid min-w-0 gap-1.5 border-t border-border/50 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{formatDayHeading(date)}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {transactions.length === 0 ? (
        <EmptyState>Nothing recorded on this day.</EmptyState>
      ) : (
        <ul className="min-w-0">
          {transactions.map((transaction) => {
            const delta = getTransactionBalanceDelta(transaction);
            const category = categories.find((entry) => entry.id === transaction.categoryId);
            const title =
              partyNameFor(transaction, partyById) ??
              category?.name ??
              transactionTypeLabels[transaction.type];

            return (
              <li
                key={transaction.id}
                className="flex items-baseline justify-between gap-3 py-1"
              >
                {/* One text flow, so the ellipsis falls wherever it runs out
                    and the row stays a single line. */}
                <span className="min-w-0 truncate text-sm text-foreground">
                  {title}
                  {category ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {category.name}
                    </span>
                  ) : null}
                </span>
                {/* The signed effect on the balance, not the stored amount:
                    an expense is stored positive and would read as money in. */}
                <Money
                  amount={delta}
                  symbol="short"
                  tone="auto"
                  signed
                  className="shrink-0 text-sm tabular-nums"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
