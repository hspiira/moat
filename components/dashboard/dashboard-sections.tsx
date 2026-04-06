"use client";

import Link from "next/link";

import { AmountIndicator } from "@/components/amount-indicator";
import { AccountBalanceBreakdown } from "@/components/accounts/account-balance-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Account, Transaction } from "@/lib/types";
import type { SummaryTile } from "@/components/dashboard/dashboard-summary-tiles";
import { DashboardSummaryTiles } from "@/components/dashboard/dashboard-summary-tiles";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardSavingsOverview({
  savingsRate,
  allocatedSavings,
  chartLabel,
}: {
  savingsRate: number;
  allocatedSavings: number;
  chartLabel: string;
}) {
  return (
    <Card className="moat-panel-sage border-border/20 shadow-none">
      <CardContent className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">
              Savings rate
            </div>
            <AmountIndicator
              tone={savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "neutral"}
              sign={savingsRate > 0 ? "positive" : savingsRate < 0 ? "negative" : "none"}
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
            <span className="font-medium text-foreground">{formatCurrency(allocatedSavings)}</span>
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
            <span className="text-right">Current</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardCashFlowSection({
  summaryTiles,
  savingsRate,
  allocatedSavings,
  chartLabel,
}: {
  summaryTiles: SummaryTile[];
  savingsRate: number;
  allocatedSavings: number;
  chartLabel: string;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
      <DashboardSavingsOverview
        savingsRate={savingsRate}
        allocatedSavings={allocatedSavings}
        chartLabel={chartLabel}
      />
      <DashboardSummaryTiles items={summaryTiles} />
    </div>
  );
}

export function DashboardTopSpendingCategories({
  categories,
}: {
  categories: {
    categoryId: string;
    categoryName: string;
    amount: number;
  }[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Top spending categories</CardTitle>
        <CardDescription>Selected period only. Transfers are excluded.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {categories.length === 0 ? (
          <EmptyState>
            No spending recorded in this period.{" "}
            <Link href="/transactions" className="underline underline-offset-4 hover:text-foreground">
              Add transactions
            </Link>
          </EmptyState>
        ) : (
          categories.map((category, index) => (
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
              <span className="text-sm font-medium text-foreground">{category.categoryName}</span>
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
  );
}

export function DashboardAccountBalances({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Current account balances</CardTitle>
        <CardDescription>
          All recorded history plus opening balances, independent of the filter.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {accounts.length === 0 ? (
          <EmptyState>
            No accounts.{" "}
            <Link href="/accounts" className="underline underline-offset-4 hover:text-foreground">
              Add an account
            </Link>
          </EmptyState>
        ) : (
          accounts.map((account, index) => (
            <div
              key={account.id}
              className={`grid gap-2 border px-4 py-3 ${
                index % 2 === 0 ? "moat-panel-sage border-border/20" : "bg-muted/20 border-border/20"
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
              <AccountBalanceBreakdown account={account} transactions={transactions} compact />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardInsightsPanel({
  insights,
}: {
  insights: { id: string; title: string; body: string }[];
}) {
  return (
    <Card className="moat-panel-lilac border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">This period</CardTitle>
        <CardDescription className="text-foreground/65">
          Prompts from the selected time window.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <EmptyState className="border-border/30 bg-background/10 py-6 text-foreground/75">
            Add more transactions for personalised prompts.
          </EmptyState>
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
  );
}

export function DashboardContinueLinks({
  modules,
}: {
  modules: { href: string; title: string; stage: string; summary: string }[];
}) {
  return (
    <section className="grid gap-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-foreground">Continue</h2>
        <p className="text-xs text-muted-foreground">Jump to any section.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
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
  );
}

export function DashboardQuickActions({
  actions,
}: {
  actions: { href: string; title: string }[];
}) {
  return (
    <section className="grid gap-3 lg:hidden">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-foreground">Quick actions</h2>
        <p className="text-xs text-muted-foreground">Jump straight into the next task.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <Button key={action.href} asChild variant="outline" className="h-10 justify-center px-3 text-xs">
            <Link href={action.href}>{action.title}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
