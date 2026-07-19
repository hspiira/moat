"use client";

import Link from "next/link";
import {
  IconBuildingBank,
  IconCash,
  IconChartLine,
  IconDeviceMobile,
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
import { Separator } from "@/components/ui/separator";

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
};

export function AccountList({ accounts, transactions, onEdit }: Props) {
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
            No accounts yet. Add your first account to get started.
          </EmptyState>
        ) : (
          active.map((account) => {
            const TypeIcon = accountTypeIcons[account.type];

            return (
              <div
                key={account.id}
                className="rounded-md border border-border/60 bg-card px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                    >
                      <TypeIcon className="size-4.5" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="truncate text-sm font-medium text-foreground">
                        {account.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {accountTypeLabels[account.type]}
                        {account.institutionName ? ` · ${account.institutionName}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/accounts/${encodeURIComponent(account.id)}`}>Ledger</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEdit(account)}>
                      Edit
                    </Button>
                  </div>
                </div>
                <Separator className="my-3 bg-border/50" />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <Money
                    amount={account.balance}
                    tone={account.balance < 0 ? "negative" : "neutral"}
                    className="text-base font-semibold"
                  />
                </div>
                <div className="mt-3">
                  <AccountBalanceBreakdown
                    account={account}
                    transactions={transactions}
                    compact
                  />
                </div>
                {account.type === "debt" ? (
                  <div className="mt-3">
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
