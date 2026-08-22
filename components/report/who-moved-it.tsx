"use client";

import Link from "next/link";

import { formatMoneyShort } from "@/lib/currency";
import { getPartyMovement, type PartyTotal } from "@/lib/domain/party-totals";
import type { Category, Counterparty, Transaction } from "@/lib/types";
import { Money } from "@/components/ui/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const SHOWN = 6;

function PartyRows({
  parties,
  categories,
  tone,
}: {
  parties: PartyTotal[];
  categories: Category[];
  tone: "negative" | "positive";
}) {
  return (
    <ul className="grid">
      {parties.slice(0, SHOWN).map((party) => {
        const named = party.categoryIds
          .map((id) => categories.find((category) => category.id === id)?.name)
          .filter(Boolean);

        return (
          <li key={party.key} className="min-w-0">
            <Link
              href={`/transactions?q=${encodeURIComponent(party.name)}`}
              className="grid gap-0.5 border-b border-border py-2.5 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {party.name}
                  {party.count > 1 ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                      {party.count}×
                    </span>
                  ) : null}
                </span>
                <Money
                  amount={party.amount}
                  tone={tone}
                  symbol="short"
                  className="shrink-0 text-sm font-semibold tabular-nums"
                />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {party.count > 1 ? `${formatMoneyShort(party.perTime)} each time · ` : ""}
                {named.length > 0 ? named.join(", ") : "No category"}
                {party.fees > 0 ? ` · ${formatMoneyShort(party.fees)} in charges` : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function WhoMovedIt({
  transactions,
  categories,
  counterparties,
}: {
  transactions: Transaction[];
  categories: Category[];
  counterparties: Counterparty[];
}) {
  const movement = getPartyMovement(transactions, counterparties);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Who took it, and who paid you</CardTitle>
        <CardDescription>
          Selected period. Moving money between your own accounts is not counted.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <section className="grid gap-1">
          <h2 className="text-xs font-medium text-muted-foreground">Took money</h2>
          {movement.out.length === 0 ? (
            <EmptyState>Nobody was paid in this period.</EmptyState>
          ) : (
            <PartyRows parties={movement.out} categories={categories} tone="negative" />
          )}
        </section>

        <section className="grid gap-1">
          <h2 className="text-xs font-medium text-muted-foreground">Paid you</h2>
          {movement.in.length === 0 ? (
            <EmptyState>Nothing came in during this period.</EmptyState>
          ) : (
            <PartyRows parties={movement.in} categories={categories} tone="positive" />
          )}
        </section>
      </CardContent>
    </Card>
  );
}
