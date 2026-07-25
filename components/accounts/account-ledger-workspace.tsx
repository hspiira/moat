"use client";

import { startTransition, useEffect, useState } from "react";

import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLedgerRows, reconcileAccountBalances } from "@/lib/domain/accounts";
import { repositories } from "@/lib/repositories/instance";
import { transactionTypeLabels } from "@/lib/select-options";
import { formatDate } from "@/lib/format-date";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";

import { AccountBalanceBreakdown } from "./account-balance-breakdown";
import { accountTypeLabels } from "./account-form";


function normalizeAccountId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}


function getRowTone(transaction: Transaction) {
  if (transaction.type === "income") {
    return "border-l-[3px] border-l-emerald-500/70 bg-emerald-500/[0.04]";
  }

  if (transaction.type === "transfer") {
    return "border-l-[3px] border-l-border/60 bg-muted/[0.18]";
  }

  return "border-l-[3px] border-l-red-500/70 bg-red-500/[0.04]";
}

export function AccountLedgerWorkspace({ accountId }: { accountId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ledgerRows = account ? getLedgerRows(account, transactions) : [];

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        setIsLoading(true);
        setError(null);

        try {
          const nextProfile = await repositories.userProfile.get();
          setProfile(nextProfile);
          const normalizedAccountId = normalizeAccountId(accountId);

          const storedAccount = await repositories.accounts.getById(normalizedAccountId);

          if (!nextProfile) {
            setAccount(null);
            setCategories([]);
            setTransactions([]);
            return;
          }

          if (!storedAccount) {
            setAccount(null);
            setCategories([]);
            setTransactions([]);
            return;
          }

          const [storedAccounts, storedTransactions, storedCategories] = await Promise.all([
            repositories.accounts.listByUser(nextProfile.id),
            repositories.transactions.listByUser(nextProfile.id),
            repositories.categories.listByUser(nextProfile.id),
          ]);

          const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);
          const nextAccount =
            reconciledAccounts.find((entry) => entry.id === normalizedAccountId) ??
            reconcileAccountBalances([storedAccount], storedTransactions).find(
              (entry) => entry.id === normalizedAccountId,
            ) ??
            null;
          const nextTransactions = storedTransactions
            .filter((transaction) => transaction.accountId === normalizedAccountId)
            .sort((left, right) => {
              if (left.occurredOn === right.occurredOn) {
                return right.createdAt.localeCompare(left.createdAt);
              }

              return right.occurredOn.localeCompare(left.occurredOn);
            });

          setAccount(nextAccount);
          setCategories(storedCategories);
          setTransactions(nextTransactions);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Couldn't load this account. Please try again.");
        } finally {
          setIsLoading(false);
        }
      })();
    });
  }, [accountId]);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {account?.name ?? "Account"}
        </h1>
        {account ? (
          <span className="text-xs text-muted-foreground">
            · {accountTypeLabels[account.type]}
          </span>
        ) : null}
      </header>

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading ledger..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding first to view account ledgers."
          href="/onboarding"
          cta="Set up your profile"
        />
      ) : null}

      {!isLoading && profile && !account ? <LoadingStateCard message="Account not found." /> : null}

      {!isLoading && profile && account ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="ring-1 ring-primary/15">
              <CardHeader className="gap-2 p-5">
                <CardDescription className="text-xs font-medium tracking-[0.14em] uppercase">
                  Current balance
                </CardDescription>
                <CardTitle className="font-display text-[clamp(1.75rem,7vw,2.25rem)] leading-none tracking-tight">
                  <Money
                    amount={account.balance}
                    tone={account.balance < 0 ? "negative" : "neutral"}
                    className="font-display"
                  />
                </CardTitle>
              </CardHeader>
            </Card>

            <AccountBalanceBreakdown account={account} transactions={transactions} />
          </div>

          <Card className="border-border/20 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Transactions affecting this account</CardTitle>
              <CardDescription>
                Every transaction here adds up to the balance above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerRows.length === 0 ? (
                <EmptyState>
                  No transactions recorded for this account.
                </EmptyState>
              ) : (
                <>
                  {/* Mobile: stacked statement list — one line per entry, no wrapping. */}
                  <ul className="flex flex-col gap-2 md:hidden">
                    {ledgerRows.map((row) => {
                      const category = categories.find((entry) => entry.id === row.categoryId);
                      const isCredit = row.credit > 0;
                      // Fold payee/category/note into one detail line; the band
                      // colour and amount colour already convey the direction,
                      // so no separate title row is needed.
                      const detail = [row.payee?.trim(), category?.name, row.note?.trim()]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <li
                          key={row.id}
                          className={`rounded-md border border-border/50 px-3 py-2.5 ${getRowTone(row.transaction)}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {formatDate(row.date)}
                              </span>
                              {detail ? <span> · {detail}</span> : null}
                            </p>
                            <div className="shrink-0 text-right leading-tight">
                              <Money
                                amount={isCredit ? row.credit : row.debit}
                                tone={isCredit ? "positive" : "negative"}
                                signed
                                className="text-sm font-semibold whitespace-nowrap"
                              />
                              <div className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                                <span aria-hidden>→ </span>
                                <Money
                                  amount={Math.abs(row.runningBalance)}
                                  tone={row.runningBalance < 0 ? "negative" : "muted"}
                                />
                                <span className="sr-only"> new balance</span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop: scrollable ledger table. Cells never wrap; Details truncates. */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="whitespace-nowrap">Details</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Debit</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Credit</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerRows.map((row) => {
                          const category = categories.find((entry) => entry.id === row.categoryId);
                          const primary = row.payee?.trim() || transactionTypeLabels[row.type];
                          const secondary = [
                            row.payee?.trim() ? transactionTypeLabels[row.type] : null,
                            category?.name,
                            row.note?.trim(),
                          ]
                            .filter(Boolean)
                            .join(" · ");

                          return (
                            <TableRow key={row.id} className={getRowTone(row.transaction)}>
                              <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                                {formatDate(row.date)}
                              </TableCell>
                              <TableCell className="max-w-88 align-top">
                                <div className="truncate text-sm text-foreground">{primary}</div>
                                {secondary ? (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {secondary}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right align-top">
                                {row.debit > 0 ? (
                                  <Money amount={row.debit} tone="negative" signed className="text-sm" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right align-top">
                                {row.credit > 0 ? (
                                  <Money amount={row.credit} tone="positive" signed className="text-sm" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right align-top">
                                <Money
                                  amount={Math.abs(row.runningBalance)}
                                  tone={row.runningBalance < 0 ? "negative" : "neutral"}
                                  className="text-sm font-medium"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
