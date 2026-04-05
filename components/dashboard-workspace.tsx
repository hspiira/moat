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
import { AmountIndicator } from "@/components/amount-indicator";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { getMonthlyInsights } from "@/lib/domain/insights";
import { getMonthSummary, getSavingsRate } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";
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

function getPreviousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function getChangePercent(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
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
  const previousMonth = getPreviousMonth(month);
  const previousSummary = useMemo(
    () => getMonthSummary(transactions, categories, previousMonth),
    [categories, previousMonth, transactions],
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
  const inflowChange = getChangePercent(summary.inflow, previousSummary.inflow);
  const outflowChange = getChangePercent(summary.outflow, previousSummary.outflow);
  const savingsChange = getChangePercent(summary.savings, previousSummary.savings);
  const summaryTiles = [
    {
      label: "Inflow",
      value: formatCurrency(summary.inflow),
      className: "moat-panel-yellow",
      tone: summary.inflow > 0 ? ("positive" as const) : ("neutral" as const),
      sign: summary.inflow > 0 ? ("positive" as const) : ("none" as const),
      change: inflowChange,
      changeTone:
        inflowChange === null
          ? ("neutral" as const)
          : inflowChange > 0
            ? ("positive" as const)
            : inflowChange < 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        inflowChange === null
          ? ("flat" as const)
          : inflowChange > 0
            ? ("up" as const)
            : inflowChange < 0
              ? ("down" as const)
              : ("flat" as const),
    },
    {
      label: "Outflow",
      value: formatCurrency(summary.outflow),
      className: "moat-panel-lilac",
      tone: summary.outflow > 0 ? ("negative" as const) : ("neutral" as const),
      sign: summary.outflow > 0 ? ("negative" as const) : ("none" as const),
      change: outflowChange,
      changeTone:
        outflowChange === null
          ? ("neutral" as const)
          : outflowChange < 0
            ? ("positive" as const)
            : outflowChange > 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        outflowChange === null
          ? ("flat" as const)
          : outflowChange < 0
            ? ("down" as const)
            : outflowChange > 0
              ? ("up" as const)
              : ("flat" as const),
    },
    {
      label: "Savings",
      value: formatCurrency(summary.savings),
      className: "moat-panel-mint",
      tone:
        summary.savings > 0
          ? ("positive" as const)
          : summary.savings < 0
            ? ("negative" as const)
            : ("neutral" as const),
      sign:
        summary.savings > 0
          ? ("positive" as const)
          : summary.savings < 0
            ? ("negative" as const)
            : ("none" as const),
      change: savingsChange,
      changeTone:
        savingsChange === null
          ? ("neutral" as const)
          : savingsChange > 0
            ? ("positive" as const)
            : savingsChange < 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        savingsChange === null
          ? ("flat" as const)
          : savingsChange > 0
            ? ("up" as const)
            : savingsChange < 0
              ? ("down" as const)
              : ("flat" as const),
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.displayName}&apos;s overview
          </h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
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
          <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
            <Card className="moat-panel-sage border-border/20 shadow-none">
              <CardContent className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">
                      Savings rate
                    </div>
                    <AmountIndicator
                      tone={
                        savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "neutral"
                      }
                      sign={
                        savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "none"
                      }
                      value={`${Math.round(savingsRate * 100)}%`}
                      className="text-6xl font-semibold tracking-tight"
                    />
                  </div>
                  <p className="max-w-md text-sm leading-6 text-foreground/75">
                    A simple view of how much of this month&apos;s inflow stayed available
                    for your future self.
                  </p>
                </div>
                <div className="grid content-end gap-2">
                  <div className="grid grid-cols-6 items-end gap-2">
                    {[28, 42, 36, 58, 44, 68].map((height, index) => (
                      <div
                        key={height}
                        className={index === 4 ? "bg-foreground" : "bg-foreground/25"}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-foreground/55">
                    <span>Past weeks</span>
                    <span>{monthLabel}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {summaryTiles.map((item) => (
                <Card
                  key={item.label}
                  className={`${item.className} border-border/20 shadow-none`}
                >
                  <CardHeader className="gap-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <CardDescription className="text-foreground/65">
                        {item.label}
                      </CardDescription>
                      <AmountIndicator
                        tone={item.changeTone}
                        direction={item.changeDirection}
                        showIcon={item.change !== null}
                        sign={
                          item.change !== null && item.change > 0
                            ? "positive"
                            : item.change !== null && item.change < 0
                              ? "negative"
                              : "none"
                        }
                        value={
                          item.change === null
                            ? "—"
                            : `${Math.abs(item.change).toFixed(0)}%`
                        }
                        className="text-xs font-medium"
                        iconClassName="h-3.5 w-3.5"
                      />
                    </div>
                    <CardTitle className="text-2xl tracking-tight">
                      <AmountIndicator
                        tone={item.tone}
                        sign={item.sign}
                        value={item.value}
                        className="text-2xl font-semibold tracking-tight"
                      />
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/20 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Top spending categories</CardTitle>
                <CardDescription>Transfers are excluded.</CardDescription>
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
                  summary.topCategories.map((category, index) => (
                    <div
                      key={category.categoryId}
                      className={`flex items-center justify-between gap-4 border px-4 py-3 ${
                        index === 0
                          ? "moat-panel-mint border-border/20"
                          : index === 1
                            ? "moat-panel-yellow border-border/20"
                            : index === 2
                              ? "moat-panel-sage border-border/20"
                              : "bg-muted/25 border-border/20"
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {category.categoryName}
                      </span>
                      <AmountIndicator
                        tone="negative"
                        sign="negative"
                        value={formatCurrency(category.amount)}
                        className="text-base font-semibold"
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 content-start">
              <Card className="border-border/20 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Account balances</CardTitle>
                  <CardDescription>Reconciled from opening balance and history.</CardDescription>
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
                    topAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        className={`flex items-center justify-between gap-4 border px-4 py-3 ${
                          index % 2 === 0
                            ? "moat-panel-sage border-border/20"
                            : "bg-muted/20 border-border/20"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {account.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {account.type.replaceAll("_", " ")}
                          </div>
                        </div>
                        <AmountIndicator
                          tone={
                            account.balance > 0
                              ? "neutral"
                              : account.balance < 0
                                ? "negative"
                                : "neutral"
                          }
                          sign={
                            account.balance < 0 ? "negative" : "none"
                          }
                          value={formatCurrency(account.balance)}
                          className="text-sm font-medium"
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="moat-panel-lilac border-border/20 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">This month</CardTitle>
                  <CardDescription className="text-foreground/65">
                    Prompts from your saved data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.length === 0 ? (
                    <p className="text-sm text-foreground/75">
                      Add more transactions for personalised prompts.
                    </p>
                  ) : (
                    <ul className="grid gap-3">
                      {insights.map((insight) => (
                        <li key={insight.id} className="flex gap-2.5 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 bg-foreground" />
                          <span className="leading-6 text-foreground/80">
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
                  className="group border-b border-border/30 px-0 py-3 transition-colors hover:border-foreground/40"
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
