"use client";

import Link from "next/link";
import {
  IconBuildingBank,
  IconCash,
  IconChartLine,
  IconDeviceMobile,
  IconPencil,
  IconReceipt2,
  IconUsersGroup,
} from "@tabler/icons-react";

import type { Account, AccountType, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";

import { accountTypeLabels } from "./account-form";
import { AccountBalanceBreakdown } from "./account-balance-breakdown";
import { DebtSummary } from "./debt-summary";

const accountTypeIcons: Record<AccountType, typeof IconCash> = {
  cash: IconCash,
  mobile_money: IconDeviceMobile,
  bank: IconBuildingBank,
  sacco: IconUsersGroup,
  investment: IconChartLine,
  debt: IconReceipt2,
};

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  onEdit: (account: Account) => void;
  onAdd?: () => void;
};

export function AccountList({ accounts, transactions, onEdit, onAdd }: Props) {
  const active = accounts.filter((a) => !a.isArchived);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your accounts</CardTitle>
        <CardDescription>Reconciled from opening balance and history.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
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
          active.map((account) => {
            const TypeIcon = accountTypeIcons[account.type];

            return (
              <div
                key={account.id}
                className="group relative -mx-4 rounded-none border-y border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/25 sm:mx-0 sm:rounded-md sm:border-x"
              >
                {/* Header: icon + name/type on the left, balance on the right.
                    The whole card links to the ledger (::after overlay); Edit
                    is lifted above the overlay so it stays independently
                    clickable without nesting a button inside the link. */}
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                  >
                    <TypeIcon className="size-4.5" />
                  </span>
                  <Link
                    href={`/accounts/${encodeURIComponent(account.id)}`}
                    aria-label={`Open ${account.name} ledger`}
                    className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']"
                  >
                    <div className="truncate text-sm font-medium text-foreground">
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
                </div>

                <div className="relative z-10 mt-2 w-fit">
                  <AccountBalanceBreakdown
                    account={account}
                    transactions={transactions}
                    compact
                  />
                </div>
                {account.type === "debt" ? (
                  <div className="relative z-10 mt-2 w-fit">
                    <DebtSummary account={account} transactions={transactions} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
