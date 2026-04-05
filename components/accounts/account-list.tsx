"use client";

import Link from "next/link";

import { AmountIndicator } from "@/components/amount-indicator";
import type { Account, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { accountTypeLabels } from "./account-form";
import { AccountBalanceBreakdown } from "./account-balance-breakdown";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  onEdit: (account: Account) => void;
};

export function AccountList({ accounts, transactions, onEdit }: Props) {
  const active = accounts.filter((a) => !a.isArchived);

  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Your accounts</CardTitle>
        <CardDescription>Reconciled from opening balance and history.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {active.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </div>
        ) : (
          active.map((account, index) => (
            <div
              key={account.id}
              className={`border px-4 py-4 ${
                index === 0
                  ? "moat-panel-mint border-border/20"
                  : index % 2 === 0
                    ? "moat-panel-sage border-border/20"
                    : "bg-muted/20 border-border/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">{account.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {accountTypeLabels[account.type]}
                    {account.institutionName ? ` · ${account.institutionName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                    <Link href={`/accounts/${encodeURIComponent(account.id)}`}>Ledger</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onEdit(account)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              <Separator className="my-3 bg-border/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance</span>
                <AmountIndicator
                  tone={account.balance < 0 ? "negative" : "neutral"}
                  sign={account.balance < 0 ? "negative" : "none"}
                  value={formatCurrency(account.balance)}
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
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
