"use client";

import { useMemo, useState } from "react";

import {
  getAccountBalanceBreakdown,
  normalizeOpeningBalance,
} from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccentCardHeader } from "@/components/accent-card-header";

import { AccountBalanceBreakdown, getRepairRecommendation } from "./account-balance-breakdown";

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
  isSubmitting: boolean;
  onRepair: (repairs: { accountId: string; openingBalance: number }[]) => Promise<void>;
};

export function RepairAccountsPanel({
  accounts,
  transactions,
  isSubmitting,
  onRepair,
}: Props) {
  const candidates = useMemo(
    () =>
      accounts
        .filter((account) => !account.isArchived)
        .map((account) => ({
          account,
          breakdown: getAccountBalanceBreakdown(account, transactions),
        }))
        .filter(
          ({ account, breakdown }) => account.type !== "debt" && breakdown.openingBalance < 0,
        ),
    [accounts, transactions],
  );

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (candidates.length === 0) {
    return null;
  }

  async function handleApplyRepairs() {
    await onRepair(
      candidates.map(({ account, breakdown }) => ({
        accountId: account.id,
        openingBalance: normalizeOpeningBalance(
          account.type,
          Number(drafts[account.id] ?? getRepairRecommendation(account, breakdown)),
        ),
      })),
    );
  }

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="lilac"
        title="Opening balance repair"
        description="These non-debt accounts have negative opening balances. Review and apply a one-time correction if this came from older corrupted data."
      />
      <CardContent className="grid gap-4 p-5">
        {candidates.map(({ account, breakdown }) => {
          const recommended = getRepairRecommendation(account, breakdown);

          return (
            <div key={account.id} className="grid gap-3 border border-border/20 px-4 py-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{account.name}</div>
                <div className="text-xs text-muted-foreground">
                  Recommended opening balance: {formatCurrency(recommended)}
                </div>
              </div>
              <AccountBalanceBreakdown account={account} transactions={transactions} />
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor={`repair-${account.id}`}>Corrected opening balance (UGX)</Label>
                <Input
                  id={`repair-${account.id}`}
                  inputMode="decimal"
                  value={drafts[account.id] ?? String(recommended)}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [account.id]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => void handleApplyRepairs()} disabled={isSubmitting}>
            {isSubmitting ? "Applying..." : "Apply repair"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
