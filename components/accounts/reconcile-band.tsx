"use client";

import { formatDate } from "@/lib/format-date";
import { getReconcileWindow } from "@/lib/domain/reconcile-window";
import type { Account, Transaction } from "@/lib/types";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";

export function ReconcileBand({
  account,
  transactions,
  onRecord,
}: {
  account: Account;
  transactions: Transaction[];
  onRecord: () => void;
}) {
  const window_ = getReconcileWindow(
    transactions.filter((transaction) => transaction.accountId === account.id),
  );
  if (!window_) return null;

  const missing = window_.gap < 0;

  return (
    <section className="grid gap-3 border border-border bg-muted/30 px-4 py-4">
      <div className="grid gap-1">
        <h2 className="font-display text-base font-semibold">
          {formatDate(window_.statedOn)} said{" "}
          <Money amount={window_.statedBalance} tone="neutral" symbol="short" />
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          The entries add up to{" "}
          <Money amount={window_.expectedBalance} tone="neutral" symbol="short" />, so{" "}
          <Money amount={Math.abs(window_.gap)} tone="negative" symbol="short" /> is{" "}
          {missing ? "spent but not recorded" : "recorded but never left the account"}.
        </p>
      </div>

      <div className="grid gap-1">
        <p className="text-xs text-muted-foreground">
          It happened between {formatDate(window_.openedOn)} and {formatDate(window_.statedOn)} , {" "}
          {window_.entries.length} {window_.entries.length === 1 ? "entry" : "entries"} below,
          nothing older. Either one is missing, or one is there twice.
        </p>
        <ul className="grid">
          {window_.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {formatDate(entry.occurredOn)} · {entry.payee ?? entry.rawPayee ?? "No payee"}
              </span>
              <Money
                amount={entry.amount}
                tone="neutral"
                symbol="short"
                className="shrink-0 text-sm tabular-nums"
              />
            </li>
          ))}
        </ul>
      </div>

      {missing ? (
        <Button type="button" size="sm" className="justify-self-start" onClick={onRecord}>
          Record what is missing
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Open the entry that is there twice and delete one of them.
        </p>
      )}
    </section>
  );
}
