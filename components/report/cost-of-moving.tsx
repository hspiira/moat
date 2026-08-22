"use client";

import Link from "next/link";

import { formatMoneyShort } from "@/lib/currency";
import { getFeeLoadByAccount } from "@/lib/domain/fees";
import type { Account, Transaction } from "@/lib/types";
import { Money } from "@/components/ui/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function CostOfMoving({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  const loads = getFeeLoadByAccount(transactions);
  const total = loads.reduce((sum, load) => sum + load.fees, 0);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">What moving money cost you</CardTitle>
        <CardDescription>
          Charges per account for this period, and what each one costs per Sh 1,000 you move
          through it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {loads.length === 0 ? (
          <EmptyState>No charges recorded in this period.</EmptyState>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 pb-1">
              <span className="text-sm text-muted-foreground">All accounts</span>
              <Money
                amount={total}
                tone="negative"
                className="text-lg font-semibold tabular-nums"
              />
            </div>

            <ul className="grid">
              {loads.map((load) => {
                const account = accounts.find((entry) => entry.id === load.accountId);
                return (
                  <li key={load.accountId} className="min-w-0">
                    <Link
                      href={`/transactions?q=${encodeURIComponent(account?.name ?? "")}`}
                      className="grid gap-0.5 border-b border-border py-2.5 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {account?.name ?? "Closed account"}
                        </span>
                        <Money
                          amount={load.fees}
                          tone="negative"
                          symbol="short"
                          className="shrink-0 text-sm font-semibold tabular-nums"
                        />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoneyShort(Math.round(load.costPerThousandMoved))} per Sh 1,000
                        moved · {load.count} {load.count === 1 ? "charge" : "charges"} on{" "}
                        {formatMoneyShort(load.movedOut)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
