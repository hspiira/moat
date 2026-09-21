"use client";

import Link from "next/link";
import { IconArrowUpRight, IconCheck, IconChevronRight, IconPlus } from "@tabler/icons-react";

import {
  DashboardBalanceSummary,
  DashboardCoverSummary,
  DashboardPlanPreview,
  DashboardRecentActivity,
} from "@/components/dashboard/dashboard-home-sections";
import { useDashboardWorkspace } from "@/components/dashboard/use-dashboard-workspace";
import { ErrorStateCard } from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountTotals } from "@/lib/domain/accounts";
import type { UserProfile } from "@/lib/types";

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <span className="sr-only" role="status">Loading your money overview…</span>
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

export function DashboardWorkspace({ profile }: { profile: UserProfile }) {
  const {
    period, setPeriod, isLoading, error, summary, cover, attentionItems,
    accounts, categories, counterparties, planPreview, recentTransactions,
    budgetCoverage, budgets, transactions, insights,
  } = useDashboardWorkspace(profile);
  const { totalBalance, activeAccounts } = getAccountTotals(accounts);
  const isNew = transactions.length === 0;
  const firstName = profile.displayName.trim().split(/\s+/)[0];
  const date = new Intl.DateTimeFormat("en-UG", {
    weekday: "short", day: "numeric", month: "long",
  }).format(new Date());
  const actions = attentionItems.slice(0, 3);
  const insight = insights[0];

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-4 sm:gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {/* The balance below is the heading in practice, so the page keeps its
              name for assistive tech without spending a line on saying it. */}
          <h1 className="sr-only">Your money</h1>
          <p className="text-xs text-muted-foreground">{date}{firstName ? ` · Hello, ${firstName}` : ""}</p>
        </div>
        <Button asChild variant="outline" className="hidden sm:inline-flex">
          <Link href="/transactions/capture?capture=expense"><IconPlus className="size-4" /> Add transaction</Link>
        </Button>
      </header>

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <DashboardSkeleton /> : error ? null : (
        <>
          <DashboardBalanceSummary
            totalBalance={totalBalance} accountCount={activeAccounts}
            inflow={summary.inflow} outflow={summary.outflow}
            period={period} onPeriodChange={setPeriod}
          />

          {isNew ? (
            <section aria-labelledby="dashboard-start" className="rounded-xl border border-primary/15 bg-primary/5 p-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Start here</p>
              <h2 id="dashboard-start" className="text-lg font-semibold">Make this your money briefing</h2>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {activeAccounts === 0 ? "Add your first account, then record or import your transactions." : "Your accounts are ready. Record an expense or import a statement to see what is moving."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild><Link href={activeAccounts === 0 ? "/accounts" : "/transactions/capture?capture=expense"}>
                  <IconPlus className="size-4" />{activeAccounts === 0 ? "Add an account" : "Record your first transaction"}
                </Link></Button>
                {activeAccounts > 0 ? <Button asChild variant="ghost"><Link href="/transactions/capture?capture=csv">Import a statement <IconArrowUpRight className="size-4" /></Link></Button> : null}
              </div>
            </section>
          ) : actions.length > 0 ? (
            <section aria-labelledby="dashboard-attention" className="grid gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-clay" />
                <h2 id="dashboard-attention" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs your attention</h2>
              </div>
              <ul className="grid gap-1">
                {actions.map((item, index) => (
                  <li key={item.id}>
                    <Link href={item.href ?? "/report"} className={`group flex min-h-14 items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors ${index === 0 ? "border border-primary/15 bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"}`}>
                      <span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.body}</span></span>
                      <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><IconCheck aria-hidden className="size-4 text-primary" />You’re up to date. No flagged items need your attention.</p>
          )}

          <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-x-8">
            <div className="grid min-w-0 content-start gap-4">
              <DashboardPlanPreview preview={planPreview} budgetCoverage={budgetCoverage} budgetCount={budgets.length} />
              <DashboardCoverSummary cover={cover} />
            </div>
            <DashboardRecentActivity transactions={recentTransactions} accounts={accounts} categories={categories} counterparties={counterparties} />
          </div>

          {!isNew ? (
            <section className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 max-w-xl">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">A closer look</p>
                <h2 className="text-sm font-semibold">{insight?.title ?? "See the story behind your spending"}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight?.body ?? "Explore trends, categories and the details of where your money goes."}</p>
              </div>
              <Link href={insight?.href ?? "/report"} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start text-sm font-medium text-primary">
                {insight?.href && insight.href !== "/report" ? "Explore this" : "Open report"}<IconArrowUpRight aria-hidden className="size-4" />
              </Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
