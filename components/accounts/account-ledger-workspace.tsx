"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
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

import { Button } from "@/components/ui/button";
import { useIncrementalList } from "@/components/hooks/use-incremental-list";
import { useRecordTransaction } from "@/components/transactions/record-transaction-sheet";

import { AccountBalanceBreakdown } from "./account-balance-breakdown";
import { DebtSummary } from "./debt-summary";
import { accountTypeLabels } from "./account-form";


function normalizeAccountId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}


export function AccountLedgerWorkspace({ accountId }: { accountId: string }) {
  const record = useRecordTransaction();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // getLedgerRows must stay oldest-first; the running balance depends on it.
  const ledgerRows = useMemo(
    () => (account ? getLedgerRows(account, transactions) : []),
    [account, transactions],
  );
  const newestFirst = useMemo(() => [...ledgerRows].reverse(), [ledgerRows]);
  const {
    visible: historyRows,
    hasMore: hasOlder,
    shownCount,
    totalCount,
    sentinelRef,
    showMore,
  } = useIncrementalList(newestFirst, { resetKey: accountId });
  const historyTotals = ledgerRows.reduce(
    (totals, row) => ({
      credit: totals.credit + row.credit,
      debit: totals.debit + row.debit,
    }),
    { credit: 0, debit: 0 },
  );

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
    // Grid items use min-width:auto, so any wide child pushes the whole page
    // wider and the document scrolls sideways. min-w-0 lets the items shrink,
    // which is what allows truncate to work on the rows below.
    <div className="grid min-w-0 gap-5">
      <header className="min-w-0 space-y-1">
        <h1 className="text-sm text-muted-foreground">
          {account?.name ?? "Account"}
          {account ? (
            <span>
              {" · "}
              {account.institutionName ?? accountTypeLabels[account.type]}
            </span>
          ) : null}
        </h1>
        {account ? (
          <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            <Money
              amount={account.balance}
              tone={account.balance < 0 ? "negative" : "neutral"}
              className="font-display"
            />
          </div>
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
          {/* The account rows carry no controls, so every action for this
              account lives here. */}
          <div className="flex gap-2">
            <Button
              onClick={() => record.open({ accountId: account.id })}
              className="flex-1 sm:flex-none sm:px-6"
            >
              Record transaction
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none sm:px-6">
              <Link href={`/accounts?edit=${encodeURIComponent(account.id)}`}>
                Edit account
              </Link>
            </Button>
          </div>

          <AccountBalanceBreakdown account={account} transactions={transactions} />

          {account.type === "debt" ? (
            <DebtSummary account={account} transactions={transactions} />
          ) : null}

          <section className="grid min-w-0 gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-xs font-medium text-muted-foreground">History</h2>
              {/* Money in and money out for this account. Each figure carries a
                  sign and a word, so the meaning does not rest on colour. */}
              <p className="flex flex-wrap items-baseline gap-x-3 text-xs">
                <span>
                  <span className="text-muted-foreground">In </span>
                  <Money amount={historyTotals.credit} tone="positive" signed />
                </span>
                <span>
                  <span className="text-muted-foreground">Out </span>
                  <Money amount={historyTotals.debit} tone="negative" signed />
                </span>
              </p>
            </div>
            <div className="min-w-0">
              {ledgerRows.length === 0 ? (
                <EmptyState>
                  No transactions recorded for this account.
                </EmptyState>
              ) : (
                <>
                  {/* Mobile: who or what leads each row in the foreground; the
                      date is metadata and reads second. */}
                  {/* min-w-0 is what makes the rows truncate. This list is a
                      grid item, so its default min-width:auto sized it to the
                      longest note, pushed the page past the viewport, and made
                      the whole account page scroll sideways. */}
                  <ul className="flex min-w-0 flex-col divide-y divide-border/50 md:hidden">
                    {historyRows.map((row) => {
                      const category = categories.find((entry) => entry.id === row.categoryId);
                      const isCredit = row.credit > 0;
                      const title =
                        row.payee?.trim() || category?.name || transactionTypeLabels[row.type];
                      const meta = [
                        formatDate(row.date),
                        row.payee?.trim() ? category?.name : null,
                        row.note?.trim(),
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <li
                          key={row.id}
                          className="min-w-0 py-2.5 transition-colors hover:bg-muted/25"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{title}</p>
                              <p className="truncate text-xs text-muted-foreground">{meta}</p>
                            </div>
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
                        {historyRows.map((row) => {
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
                            <TableRow key={row.id}>
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

                  {hasOlder ? (
                    <div className="grid justify-items-center gap-1 pt-3">
                      <Button variant="ghost" size="sm" onClick={showMore}>
                        Show older
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {shownCount} of {totalCount}
                      </p>
                    </div>
                  ) : null}
                  <div ref={sentinelRef} aria-hidden className="h-px" />
                </>
              )}
            </div>
          </section>

          {record.sheet}
        </>
      ) : null}
    </div>
  );
}
