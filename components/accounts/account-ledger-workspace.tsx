"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { AmountIndicator } from "@/components/amount-indicator";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";

import { AccountBalanceBreakdown } from "./account-balance-breakdown";
import { accountTypeLabels } from "./account-form";

const repositories = createIndexedDbRepositories();

function normalizeAccountId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatLedgerDate(date: string) {
  const [year, month, day] = date.split("-");
  return [day, month, year].join("-");
}

const transactionTypeLabels: Record<Transaction["type"], string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  savings_contribution: "Savings contribution",
  debt_payment: "Debt payment",
};

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
          setError(loadError instanceof Error ? loadError.message : "Unable to load ledger.");
        } finally {
          setIsLoading(false);
        }
      })();
    });
  }, [accountId]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={account?.name ?? "Account"}
        description="Trace the current balance from opening balance and recorded movements."
        aside={
          <div className="flex items-center gap-2">
            {account ? (
              <MetricChip value={accountTypeLabels[account.type]} label="Account ledger" />
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/accounts">Back to accounts</Link>
            </Button>
          </div>
        }
      />

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
            <Card className="moat-panel-sage border-border/20 shadow-none">
              <CardHeader className="gap-2 p-5">
                <CardDescription className="text-foreground/65">
                  {accountTypeLabels[account.type]}
                </CardDescription>
                <CardTitle className="text-4xl tracking-tight">
                  <AmountIndicator
                    tone={account.balance < 0 ? "negative" : "neutral"}
                    sign={account.balance < 0 ? "negative" : "none"}
                    value={formatCurrency(account.balance)}
                    className="text-4xl font-semibold tracking-tight"
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
                Every row below contributes directly to the current balance above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerRows.length === 0 ? (
                <EmptyState>
                  No transactions recorded for this account.
                </EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead className="w-[140px]">Type</TableHead>
                      <TableHead className="w-[180px]">Payee</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[140px] text-right">Debit</TableHead>
                      <TableHead className="w-[140px] text-right">Credit</TableHead>
                      <TableHead className="w-[160px] text-right">Running balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerRows.map((row) => {
                      const category = categories.find((entry) => entry.id === row.categoryId);
                      const balanceTone =
                        row.runningBalance < 0 ? "negative" : row.runningBalance > 0 ? "positive" : "neutral";

                      return (
                        <TableRow key={row.id} className={getRowTone(row.transaction)}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatLedgerDate(row.date)}
                          </TableCell>
                          <TableCell className="text-sm text-foreground/82">
                            {category?.name ?? "Uncategorized"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {transactionTypeLabels[row.type]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.payee?.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.note?.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <AmountIndicator
                              tone={row.debit > 0 ? "negative" : "neutral"}
                              sign={row.debit > 0 ? "negative" : "none"}
                              value={row.debit > 0 ? formatCurrency(row.debit) : "—"}
                              className="justify-end text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <AmountIndicator
                              tone={row.credit > 0 ? "positive" : "neutral"}
                              sign={row.credit > 0 ? "positive" : "none"}
                              value={row.credit > 0 ? formatCurrency(row.credit) : "—"}
                              className="justify-end text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <AmountIndicator
                              tone={balanceTone}
                              sign={
                                row.runningBalance < 0
                                  ? "negative"
                                  : row.runningBalance > 0
                                    ? "positive"
                                    : "none"
                              }
                              value={formatCurrency(Math.abs(row.runningBalance))}
                              className="justify-end text-sm"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
