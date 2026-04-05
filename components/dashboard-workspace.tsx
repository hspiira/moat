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
import { Badge } from "@/components/ui/badge";
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
    .filter((account) => !account.isArchived)
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                Issue #7
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  {profile.displayName}&apos;s monthly dashboard
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  The overview route now reads from persisted data and converts
                  transactions into a monthly cash-flow picture, top spending
                  categories, and actionable prompts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/transactions">Record or import transactions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/accounts">Manage accounts</Link>
              </Button>
            </div>
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
                <Card
                  className="border-border/70 bg-muted/50 shadow-none"
                  key={item.label}
                  size="sm"
                >
                  <CardHeader className="space-y-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {item.label}
                    </CardDescription>
                    <CardTitle className="text-sm leading-6 font-medium">
                      {item.value}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <Card className="m-4 border-border/70 bg-primary/5 shadow-none">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit bg-background/70">
                Monthly prompts
              </Badge>
              <CardTitle className="text-2xl">What needs attention now</CardTitle>
              <CardDescription className="text-sm leading-7">
                These prompts are generated from saved account and transaction data,
                not placeholder copy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                {insights.length === 0 ? (
                  <li>No monthly prompts yet. Add more transaction history for a richer dashboard.</li>
                ) : (
                  insights.map((insight) => (
                    <li className="flex gap-2" key={insight.id}>
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="font-medium text-foreground">{insight.title}:</span>{" "}
                        {insight.body}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-6 py-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading dashboard...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Top spending categories this month</CardTitle>
                <CardDescription className="leading-7">
                  Transfer records are excluded so this reflects actual spending
                  and debt payments only.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {summary.topCategories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                    No spending categories recorded this month yet.
                  </div>
                ) : (
                  summary.topCategories.map((category) => (
                    <Card
                      key={category.categoryId}
                      className="border-border/70 bg-muted/35 shadow-none"
                    >
                      <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
                        <div>
                          <div className="font-medium text-foreground">
                            {category.categoryName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Category spend for {month}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(category.amount)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Tracked account balances</CardTitle>
                <CardDescription className="leading-7">
                  Balances are reconciled from opening balance plus saved transaction history.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {topAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                    No accounts available yet.
                  </div>
                ) : (
                  topAccounts.map((account) => (
                    <Card
                      key={account.id}
                      className="border-border/70 bg-muted/35 shadow-none"
                    >
                      <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
                        <div>
                          <div className="font-medium text-foreground">{account.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.type.replaceAll("_", " ")}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(account.balance)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <section className="space-y-6">
            <div className="space-y-2">
              <Badge variant="outline">Modules</Badge>
              <h2 className="text-2xl font-semibold tracking-tight">
                Continue implementation from the dashboard
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                The dashboard is now live. The remaining routed modules are still the next
                implementation surfaces for goals, guidance, and education.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {modulePreviews.map((module) => (
                <Card key={module.href} className="border-border/70 bg-background/90">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">{module.stage}</Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link href={module.href}>Open</Link>
                      </Button>
                    </div>
                    <CardTitle>{module.title}</CardTitle>
                    <CardDescription className="leading-7">
                      {module.summary}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
