"use client";

import { useMemo } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";
import { PARTY_LEDGERS } from "@/lib/domain/reserved-accounts";
import {
  countAccountTransactions,
  findDuplicatePoolAccounts,
} from "@/lib/domain/account-cleanup";
import type { Account, Transaction } from "@/lib/types";

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  isSubmitting: boolean;
  onMerge: (sourceId: string, targetId: string) => void;
};

export function DuplicateAccountsPanel({
  accounts,
  transactions,
  isSubmitting,
  onMerge,
}: Props) {
  const duplicates = useMemo(() => findDuplicatePoolAccounts(accounts), [accounts]);

  const targetFor = (duplicate: Account) =>
    accounts.find(
      (account) =>
        PARTY_LEDGERS.some((ledger) => ledger.poolAccountId === account.id) &&
        account.type === duplicate.type,
    );

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <Card className="gap-0 pt-0 shadow-none">
      <AccentCardHeader
        title="Duplicate accounts"
        description="These have the same name as an account Moat sets up for everyone. Merging keeps every record and turns the account into the person it was named after."
      />
      <CardContent className="grid gap-4 p-5">
        {duplicates.map((duplicate) => {
          const target = targetFor(duplicate);
          const count = countAccountTransactions(duplicate.id, transactions);

          return (
            <div
              key={duplicate.id}
              className="grid gap-3 px-4 py-4 sm:flex sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">{duplicate.name}</div>
                <div className="text-xs text-muted-foreground">
                  {count === 1 ? "1 transaction" : `${count} transactions`}
                  {duplicate.openingBalance !== 0
                    ? ` · opening balance ${formatMoney(Math.abs(duplicate.openingBalance), "UGX")}`
                    : ""}
                </div>
              </div>
              {target ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => onMerge(duplicate.id, target.id)}
                >
                  Merge into {target.name}
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
