"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { AmountIndicator } from "@/components/amount-indicator";
import { Button } from "@/components/ui/button";
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
import { reconcileAccountBalances } from "@/lib/domain/accounts";
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

function getTransactionTone(transaction: Transaction) {
  if (transaction.type === "income") {
    return { tone: "positive" as const, sign: "positive" as const };
  }

  if (transaction.type === "transfer") {
    return {
      tone: "neutral" as const,
      sign: "none" as const,
      direction: "transfer" as const,
    };
  }

  return { tone: "negative" as const, sign: "negative" as const };
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
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Account ledger
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {account?.name ?? "Account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Trace the current balance from opening balance and recorded movements.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/accounts">Back to accounts</Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/20 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading ledger...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/20 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Complete onboarding first to view account ledgers.
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile && !account ? (
        <Card className="border-border/20 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Account not found.
          </CardContent>
        </Card>
      ) : null}

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
              {transactions.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                  No transactions recorded for this account.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead className="w-[140px]">Category</TableHead>
                      <TableHead className="w-[160px]">Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[160px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const category = categories.find((entry) => entry.id === transaction.categoryId);
                      const presentation = getTransactionTone(transaction);

                      return (
                        <TableRow key={transaction.id} className={getRowTone(transaction)}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatLedgerDate(transaction.occurredOn)}
                          </TableCell>
                          <TableCell className="text-sm text-foreground/82">
                            {category?.name ?? "Uncategorized"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {transactionTypeLabels[transaction.type]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {transaction.note?.trim() || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <AmountIndicator
                              tone={presentation.tone}
                              sign={presentation.sign}
                              direction={presentation.direction}
                              showIcon={transaction.type === "transfer"}
                              value={formatCurrency(Math.abs(transaction.amount))}
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
