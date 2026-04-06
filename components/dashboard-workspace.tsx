"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { AmountIndicator } from "@/components/amount-indicator";
import { AccountBalanceBreakdown } from "@/components/accounts/account-balance-breakdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { modulePreviews } from "@/lib/data";
import { getBudgetCoverage, getBudgetEnvelopes } from "@/lib/domain/budgets";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import {
  buildPeriodWindow,
  getAggregateBalanceAtDate,
  getChangePercent,
  getPeriodChartLabel,
  type PeriodFilter,
} from "@/lib/domain/dashboard";
import { getMonthlyInsights } from "@/lib/domain/insights";
import {
  getSavingsRate,
  getSummaryForTransactions,
} from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, BudgetTarget, Category, Transaction, UserProfile } from "@/lib/types";

const repositories = createIndexedDbRepositories();

type DashboardWorkspaceProps = {
  profile: UserProfile;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardWorkspace({ profile }: DashboardWorkspaceProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [storedAccounts, storedCategories, storedTransactions, storedBudgets] = await Promise.all([
        repositories.accounts.listByUser(profile.id),
        repositories.categories.listByUser(profile.id),
        repositories.transactions.listByUser(profile.id),
        repositories.budgets.listByMonth(profile.id, currentMonth),
      ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
      setBudgets(storedBudgets);
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

  const periodWindow = useMemo(
    () => buildPeriodWindow(transactions, period, new Date()),
    [period, transactions],
  );
  const currentTransactions = periodWindow.current;
  const previousTransactions = periodWindow.previous;
  const openingBalance = useMemo(
    () => getAggregateBalanceAtDate(accounts, transactions, periodWindow.currentStart),
    [accounts, periodWindow.currentStart, transactions],
  );
  const summary = useMemo(
    () => getSummaryForTransactions(currentTransactions, categories, openingBalance),
    [categories, currentTransactions, openingBalance],
  );
  const previousSummary = useMemo(
    () => getSummaryForTransactions(previousTransactions, categories),
    [categories, previousTransactions],
  );
  const savingsRate = useMemo(() => getSavingsRate(summary), [summary]);
  const insights = useMemo(
    () => getMonthlyInsights(summary, currentTransactions, accounts, period),
    [accounts, currentTransactions, period, summary],
  );
  const chartLabel = getPeriodChartLabel(period);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.occurredOn.startsWith(currentMonth)),
    [currentMonth, transactions],
  );
  const budgetCoverage = useMemo(
    () => getBudgetCoverage(budgets, monthTransactions),
    [budgets, monthTransactions],
  );
  const budgetEnvelopes = useMemo(
    () => getBudgetEnvelopes(budgets, categories, monthTransactions).slice(0, 4),
    [budgets, categories, monthTransactions],
  );

  const topAccounts = [...accounts]
    .filter((account) => !account.isArchived)
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 4);

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
        inflowChange.kind === "none"
          ? ("neutral" as const)
          : inflowChange.kind === "new"
            ? ("positive" as const)
            : (inflowChange.value ?? 0) > 0
            ? ("positive" as const)
            : (inflowChange.value ?? 0) < 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        inflowChange.kind === "none"
          ? ("flat" as const)
          : inflowChange.kind === "new"
            ? ("up" as const)
            : (inflowChange.value ?? 0) > 0
            ? ("up" as const)
            : (inflowChange.value ?? 0) < 0
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
        outflowChange.kind === "none"
          ? ("neutral" as const)
          : outflowChange.kind === "new"
            ? ("negative" as const)
            : (outflowChange.value ?? 0) < 0
            ? ("positive" as const)
            : (outflowChange.value ?? 0) > 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        outflowChange.kind === "none"
          ? ("flat" as const)
          : outflowChange.kind === "new"
            ? ("up" as const)
            : (outflowChange.value ?? 0) < 0
            ? ("down" as const)
            : (outflowChange.value ?? 0) > 0
              ? ("up" as const)
              : ("flat" as const),
    },
    {
      label: "Saved",
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
        savingsChange.kind === "none"
          ? ("neutral" as const)
          : savingsChange.kind === "new"
            ? ("positive" as const)
            : (savingsChange.value ?? 0) > 0
            ? ("positive" as const)
            : (savingsChange.value ?? 0) < 0
              ? ("negative" as const)
              : ("neutral" as const),
      changeDirection:
        savingsChange.kind === "none"
          ? ("flat" as const)
          : savingsChange.kind === "new"
            ? ("up" as const)
            : (savingsChange.value ?? 0) > 0
            ? ("up" as const)
            : (savingsChange.value ?? 0) < 0
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
          <p className="text-sm text-muted-foreground">{periodWindow.overviewLabel}</p>
        </div>
        <div className="flex items-center gap-1 border border-border/30 p-1">
          {[
            { id: "week", label: "W" },
            { id: "month", label: "M" },
            { id: "year", label: "Y" },
            { id: "all", label: "All" },
          ].map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={period === option.id ? "secondary" : "ghost"}
              className="min-w-9"
              onClick={() => setPeriod(option.id as PeriodFilter)}
            >
              {option.label}
            </Button>
          ))}
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
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">{periodWindow.title}</h2>
            <p className="text-xs text-muted-foreground">{periodWindow.caption}</p>
          </div>

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
                    Based only on the selected period. This rate uses inflow minus outflow, while
                    explicit savings contributions stay separate to avoid double counting. Current
                    account balances below include opening balances and prior history too.
                  </p>
                  <div className="text-xs text-foreground/65">
                    Tagged savings contributions:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(summary.allocatedSavings)}
                    </span>
                  </div>
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
                    <span>{chartLabel}</span>
                    <span className="text-right">{period === "all" ? "Now" : "Current"}</span>
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
                        showIcon={item.change.kind !== "none"}
                        sign={
                          item.change.kind === "new"
                            ? "positive"
                            : item.change.kind === "delta" && (item.change.value ?? 0) > 0
                            ? "positive"
                            : item.change.kind === "delta" && (item.change.value ?? 0) < 0
                              ? "negative"
                              : "none"
                        }
                        value={
                          item.change.kind === "none"
                            ? "—"
                            : item.change.kind === "new"
                              ? "New"
                              : `${Math.abs(item.change.value ?? 0).toFixed(0)}%`
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
                <CardDescription>Selected period only. Transfers are excluded.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {summary.topCategories.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                    No spending recorded in this period.{" "}
                    <Link
                      href="/transactions"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
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
                  <CardTitle className="text-base">Current account balances</CardTitle>
                  <CardDescription>
                    All recorded history plus opening balances, independent of the filter.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {topAccounts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                      No accounts.{" "}
                      <Link
                        href="/accounts"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Add an account
                      </Link>
                    </div>
                  ) : (
                    topAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        className={`grid gap-2 border px-4 py-3 ${
                          index % 2 === 0
                            ? "moat-panel-sage border-border/20"
                            : "bg-muted/20 border-border/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">{account.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {account.type.replaceAll("_", " ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                              <Link href={`/accounts/${encodeURIComponent(account.id)}`}>Ledger</Link>
                            </Button>
                            <AmountIndicator
                              tone={account.balance < 0 ? "negative" : "neutral"}
                              sign={account.balance < 0 ? "negative" : "none"}
                              value={formatCurrency(account.balance)}
                              className="text-sm font-medium"
                            />
                          </div>
                        </div>
                        <AccountBalanceBreakdown
                          account={account}
                          transactions={transactions}
                          compact
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/20 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Budget coverage</CardTitle>
                  <CardDescription>
                    Current month only. Envelopes track allocated, spent, and remaining.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {budgets.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No budgets set yet. Add envelopes from Transactions.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2 border border-border/20 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground/72">Allocated</span>
                          <AmountIndicator
                            tone="neutral"
                            sign="none"
                            value={formatCurrency(budgetCoverage.allocated)}
                            className="text-sm font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground/72">Spent</span>
                          <AmountIndicator
                            tone="negative"
                            sign="negative"
                            value={formatCurrency(budgetCoverage.spent)}
                            className="text-sm font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground/72">Remaining</span>
                          <AmountIndicator
                            tone={
                              budgetCoverage.remaining > 0
                                ? "positive"
                                : budgetCoverage.remaining < 0
                                  ? "negative"
                                  : "neutral"
                            }
                            sign={
                              budgetCoverage.remaining > 0
                                ? "positive"
                                : budgetCoverage.remaining < 0
                                  ? "negative"
                                  : "none"
                            }
                            value={formatCurrency(Math.abs(budgetCoverage.remaining))}
                            className="text-sm font-medium"
                          />
                        </div>
                      </div>

                      {budgetEnvelopes.map((envelope) => (
                        <div
                          key={envelope.categoryId}
                          className="flex items-center justify-between gap-3 border border-border/20 px-4 py-3 text-sm"
                        >
                          <span className="text-foreground">{envelope.categoryName}</span>
                          <AmountIndicator
                            tone={
                              envelope.remaining > 0
                                ? "positive"
                                : envelope.remaining < 0
                                  ? "negative"
                                  : "neutral"
                            }
                            sign={
                              envelope.remaining > 0
                                ? "positive"
                                : envelope.remaining < 0
                                  ? "negative"
                                  : "none"
                            }
                            value={formatCurrency(Math.abs(envelope.remaining))}
                            className="text-sm font-medium"
                          />
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="moat-panel-lilac border-border/20 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Period balance bridge</CardTitle>
                  <CardDescription className="text-foreground/65">
                    Opening plus movement equals closing for the selected period.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  {[
                    ["Opening balance", summary.openingBalance],
                    ["Inflow", summary.inflow],
                    ["Outflow", -summary.outflow],
                    ["Allocated savings", -summary.allocatedSavings],
                    ["Movement", summary.movement],
                    ["Closing balance", summary.closingBalance],
                  ].map(([label, amount]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-border/15 pb-2 last:border-b-0 last:pb-0"
                    >
                      <span className="text-foreground/72">{label}</span>
                      <AmountIndicator
                        tone={
                          Number(amount) > 0
                            ? "positive"
                            : Number(amount) < 0
                              ? "negative"
                              : "neutral"
                        }
                        sign={
                          Number(amount) > 0
                            ? "positive"
                            : Number(amount) < 0
                              ? "negative"
                              : "none"
                        }
                        value={formatCurrency(Math.abs(Number(amount)))}
                        className="text-sm font-medium"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="moat-panel-lilac border-border/20 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">This period</CardTitle>
                  <CardDescription className="text-foreground/65">
                    Prompts from the selected time window.
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
