"use client";

import Link from "next/link";
import { IconArchive, IconArchiveOff, IconPencil, IconTrash } from "@tabler/icons-react";

import type { Account, Transaction } from "@/lib/types";
import { canDeleteAccount } from "@/lib/domain/account-cleanup";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";

import { accountTypeLabels } from "./account-form";


type Props = {
  accounts: Account[];
  transactions: Transaction[];
  onEdit: (account: Account) => void;
  onAdd?: () => void;
  onArchive?: (accountId: string, isArchived: boolean) => void;
  onDelete?: (accountId: string) => void;
};

export function AccountList({
  accounts,
  transactions,
  onEdit,
  onAdd,
  onArchive,
  onDelete,
}: Props) {
  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  return (
    <section>
        {active.length === 0 ? (
          <EmptyState>
            <p>No accounts yet. Add your first account to get started.</p>
            {onAdd ? (
              <Button size="sm" className="mt-3" onClick={onAdd}>
                Add account
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <div>
          {active.map((account) => {
            return (
              <div
                key={account.id}
                className="group relative -mx-2 rounded-lg px-2 py-3.5 transition-colors hover:bg-muted/25"
              >
                {/* The whole row links to the ledger (::after overlay); the
                    action buttons are lifted above the overlay so they stay
                    independently clickable without nesting inside the link. */}
                <div className="flex items-center gap-3">
                  <Link
                    href={`/accounts/${encodeURIComponent(account.id)}`}
                    aria-label={`Open ${account.name} ledger`}
                    className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']"
                  >
                    <div className="truncate text-base font-medium text-foreground">
                      {account.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {accountTypeLabels[account.type]}
                      {account.institutionName ? ` · ${account.institutionName}` : ""}
                    </div>
                  </Link>
                  <Money
                    amount={account.balance}
                    tone={account.balance < 0 ? "negative" : "neutral"}
                    className="shrink-0 text-right text-base font-semibold"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${account.name}`}
                    className="relative z-10 size-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(account)}
                  >
                    <IconPencil />
                  </Button>
                  {onArchive ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Archive ${account.name}`}
                      title={`Archive ${account.name}`}
                      className="relative z-10 size-9 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => onArchive(account.id, true)}
                    >
                      <IconArchive />
                    </Button>
                  ) : null}
                  {onDelete && canDeleteAccount(account, transactions).allowed ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${account.name}`}
                      title={`Delete ${account.name}`}
                      className="relative z-10 size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(account.id)}
                    >
                      <IconTrash />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>
        )}

        {archived.length > 0 ? (
          <div className="mt-4 px-4 pt-4">
            <div className="text-xs font-medium text-muted-foreground">
              Archived ({archived.length})
            </div>
            <div className="mt-2 grid gap-1">
              {archived.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 py-1">
                  <span className="truncate text-sm text-muted-foreground">{account.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {onArchive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => onArchive(account.id, false)}
                      >
                        <IconArchiveOff className="mr-1 size-3.5" />
                        Restore
                      </Button>
                    ) : null}
                    {onDelete && canDeleteAccount(account, transactions).allowed ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${account.name}`}
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(account.id)}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
    </section>
  );
}
