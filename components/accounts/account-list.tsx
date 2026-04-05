"use client";

import type { Account } from "@/lib/types";
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  accounts: Account[];
  onEdit: (account: Account) => void;
};

export function AccountList({ accounts, onEdit }: Props) {
  const active = accounts.filter((a) => !a.isArchived);

  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Your accounts</CardTitle>
        <CardDescription>
          All accounts reconciled from opening balance and transaction history.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {active.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </div>
        ) : (
          active.map((account) => (
            <Card key={account.id} className="border-border/40 bg-muted/30 shadow-none">
              <CardContent className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {accountTypeLabels[account.type]}
                      {account.institutionName ? ` · ${account.institutionName}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onEdit(account)}
                  >
                    Edit
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
