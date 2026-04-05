"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { modulePreviews } from "@/lib/data";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { getMonthlyInsights } from "@/lib/domain/insights";
import { getMonthSummary, getSavingsRate } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const repositories = createIndexedDbRepositories();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

type DashboardWorkspaceProps = {
  profile: UserProfile;
};

/**
 * Render the user's dashboard workspace showing an overview of the current month,
 * key metrics, top spending categories, account balances, insights, and navigation links.
 *
 * @param profile - The current user's profile used to scope data loading and display the user's name
 * @returns The dashboard UI for the given user profile
 */
export function DashboardWorkspace({ profile }: DashboardWorkspaceProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [storedAccounts, storedCategories, storedTransactions] = await Promise.all([
        repositories.accounts.listByUser(profile.id),
        repositories.categories.listByUser(profile.id),
        repositories.transactions.listByUser(profile.id),
      ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    startTransition(() => {
      void loadDashboard();
    });
  }, [profile.id]);

  const month = getCurrentMonth();

  const summary = useMemo(
    () => getMonthSummary(transactions, categories, month),
    [categories, month, transactions],
  );

  const savingsRate = useMemo(() => getSavingsRate(summary), [summary]);
  const insights = useMemo(
    () => getMonthlyInsights(summary, transactions, accounts, month),
    [accounts, month, summary, transactions],
  );

  const topAccounts = [...accounts]
    .filter((a) => !a.isArchived)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 4);

  const monthLabel = new Date(month + "-01").toLocaleString("en-UG", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.displayName}&apos;s overview
          </h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/transactions">Add transaction</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/accounts">Accounts</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading dashboard...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Inflow", value: formatCurrency(summary.inflow) },
              { label: "Outflow", value: formatCurrency(summary.outflow) },
              { label: "Savings", value: formatCurrency(summary.savings) },
              {
                label: "Savings rate",
                value: `${Math.round(savingsRate * 100)}%`,
              },
            ].map((item) => (
              <Card key={item.label} className="border-border/40 shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="text-xl tabular-nums">{item.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Top spending categories</CardTitle>
                <CardDescription>
                  Transfers excluded — this shows actual spending and debt payments only.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {summary.topCategories.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                    No spending recorded this month.{" "}
                    <Link href="/transactions" className="underline underline-offset-4 hover:text-foreground">
                      Add transactions
                    </Link>
                  </div>
                ) : (
                  summary.topCategories.map((category) => (
                    <div
                      key={category.categoryId}
                      className="flex items-center justify-between gap-4 rounded-md border border-border/40 bg-muted/30 px-4 py-3"
                    >
                      <span className="text-sm text-foreground">{category.categoryName}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 content-start">
              <Card className="border-border/40 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Account balances</CardTitle>
                  <CardDescription>
                    Reconciled from opening balance and transaction history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {topAccounts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                      No accounts.{" "}
                      <Link href="/accounts" className="underline underline-offset-4 hover:text-foreground">
                        Add an account
                      </Link>
                    </div>
                  ) : (
                    topAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-4 rounded-md border border-border/40 bg-muted/30 px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {account.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {account.type.replaceAll("_", " ")}
                          </div>
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">This month</CardTitle>
                  <CardDescription>
                    Prompts based on your saved data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add more transactions for personalised prompts.
                    </p>
                  ) : (
                    <ul className="grid gap-3">
                      {insights.map((insight) => (
                        <li key={insight.id} className="flex gap-2.5 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="text-muted-foreground leading-6">
                            <span className="font-medium text-foreground">{insight.title}: </span>
                            {insight.body}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <section className="grid gap-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium text-foreground">Continue</h2>
              <p className="text-xs text-muted-foreground">Jump to any section.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {modulePreviews.map((module) => (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group rounded-md border border-border/40 bg-muted/30 px-4 py-4 transition-colors hover:border-border/70 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{module.title}</span>
                    <span className="text-xs text-muted-foreground">{module.stage}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
