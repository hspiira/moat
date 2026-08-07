"use client";

import Link from "next/link";
import { IconArchiveOff, IconPencil, IconTrash } from "@tabler/icons-react";

import type { Account, AccountType, Transaction } from "@/lib/types";
import { canDeleteAccount } from "@/lib/domain/account-cleanup";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";

/** Holdings, largest groups first by convention of use; claims tracked apart. */
const HOLDING_ORDER: AccountType[] = ["bank", "mobile_money", "cash", "sacco", "investment"];
const CLAIM_TYPES: AccountType[] = ["debt", "receivable"];

const GROUP_LABELS: Record<AccountType, string> = {
  bank: "Banks",
  mobile_money: "Mobile money",
  cash: "Cash",
  sacco: "SACCOs",
  investment: "Investments",
  debt: "Tracking",
  receivable: "Tracking",
};

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  onEdit: (account: Account) => void;
  onAdd?: () => void;
  onArchive?: (accountId: string, isArchived: boolean) => void;
  onDelete?: (accountId: string) => void;
};

function AccountRow({ account, onEdit }: { account: Account; onEdit: (a: Account) => void }) {
  return (
    <div className="group relative -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/25">
      {/* The whole row links to the ledger (::after overlay); edit is lifted
          above the overlay so it stays independently clickable. Archive and
          delete moved into the edit sheet — rare actions were spending the
          right edge of every row, and the balances could never line up. */}
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${encodeURIComponent(account.id)}`}
          aria-label={`Open ${account.name} ledger`}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']"
        >
          <div className="truncate text-base font-medium text-foreground">{account.name}</div>
          {account.institutionName ? (
            <div className="truncate text-xs text-muted-foreground">
              {account.institutionName}
            </div>
          ) : null}
        </Link>
        <Money
          amount={account.balance}
          tone={account.balance < 0 ? "negative" : "neutral"}
          className="shrink-0 text-right text-base font-semibold"
        />
        <button
          type="button"
          aria-label={`Edit ${account.name}`}
          onClick={() => onEdit(account)}
          className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <IconPencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

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

  // One pass over the ledger instead of a full scan per account per render.
  const deletable = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of transactions) {
      counts.set(transaction.accountId, (counts.get(transaction.accountId) ?? 0) + 1);
    }
    return new Set(
      accounts
        .filter((account) => !counts.has(account.id) && canDeleteAccount(account, []).allowed)
        .map((account) => account.id),
    );
  }, [accounts, transactions]);

  const holdingGroups = HOLDING_ORDER.map((type) => ({
    type,
    label: GROUP_LABELS[type],
    accounts: active.filter((account) => account.type === type),
  })).filter((group) => group.accounts.length > 0);

  // Control accounts for lending and borrowing. Kept apart and quiet: they are
  // bookkeeping, not money you can spend, and at zero they are pure noise
  // among real balances.
  const claims = active.filter((account) => CLAIM_TYPES.includes(account.type));
  const activeClaims = claims.filter((account) => account.balance !== 0);

  return (
    <section className="grid gap-5">
      {active.length === 0 ? (
        <EmptyState>
          <p>No accounts yet. Add your first account to get started.</p>
          {onAdd ? (
            <Button className="mt-3" onClick={onAdd}>
              Add account
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          {holdingGroups.map((group) => {
            const subtotal = group.accounts.reduce((sum, account) => sum + account.balance, 0);
            return (
              <div key={group.type}>
                <div className="flex items-baseline justify-between gap-4 pb-1">
                  <h2 className="text-xs font-medium text-muted-foreground">{group.label}</h2>
                  {group.accounts.length > 1 ? (
                    <Money
                      amount={subtotal}
                      tone="muted"
                      className="text-xs font-medium"
                    />
                  ) : null}
                </div>
                {group.accounts.map((account) => (
                  <AccountRow key={account.id} account={account} onEdit={onEdit} />
                ))}
              </div>
            );
          })}

          {activeClaims.length > 0 ? (
            <div>
              <h2 className="pb-1 text-xs font-medium text-muted-foreground">Tracking</h2>
              {activeClaims.map((account) => (
                <AccountRow key={account.id} account={account} onEdit={onEdit} />
              ))}
            </div>
          ) : null}
        </>
      )}

      {archived.length > 0 ? (
        <div>
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
                  {onDelete && deletable.has(account.id) ? (
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
