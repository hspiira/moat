"use client";

import Link from "next/link";
import { useState } from "react";
import {
  IconArrowDownRight,
  IconArrowsExchange,
  IconArrowUpRight,
  IconChevronRight,
  IconPigMoney,
  IconReceipt2,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";

import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import { transactionTypeLabels } from "@/components/transactions/transaction-form";
import { Money } from "@/components/ui/money";
import type { CoverStatus } from "@/lib/domain/cover";
import type { PeriodFilter } from "@/lib/domain/dashboard";
import { counterpartiesById, partyNameFor } from "@/lib/domain/party-name";
import { describeBillTiming, type PlanPreview } from "@/lib/domain/plan-preview";
import { formatDate } from "@/lib/format-date";
import type {
  Account,
  Category,
  Counterparty,
  Transaction,
  TransactionType,
} from "@/lib/types";

const RECENT_COUNT = 3;

export function DashboardBalanceSummary({
  totalBalance, accountCount, inflow, outflow, period, onPeriodChange,
}: {
  totalBalance: number;
  accountCount: number;
  inflow: number;
  outflow: number;
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  return (
    <section aria-label="Your balance and cash flow" className="min-w-0 px-1 py-1 sm:px-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Total balance · now</p>
        <button type="button" onClick={() => setBalanceVisible(!balanceVisible)} aria-label={balanceVisible ? "Hide balance" : "Show balance"} aria-pressed={!balanceVisible} className="-my-3 -mr-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted">
          {balanceVisible ? <IconEye className="size-4" /> : <IconEyeOff className="size-4" />}
        </button>
      </div>
      <div className="mt-2 min-w-0 font-display text-[clamp(1.75rem,8.5vw,3.25rem)] leading-tight font-semibold tracking-tight" data-testid="dashboard-balance">
        {balanceVisible ? <Money amount={totalBalance} signed={totalBalance < 0} tone={totalBalance < 0 ? "negative" : "neutral"} className="font-display" /> : <span aria-label="Balance hidden">••••••</span>}
      </div>
      <Link href="/accounts" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-primary">
        Across {accountCount} {accountCount === 1 ? "account" : "accounts"}<IconChevronRight aria-hidden className="size-3.5" />
      </Link>
      <div className="mt-2 border-t border-border/60 pt-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3">
          <h2 className="text-xs font-medium text-muted-foreground">Cash flow</h2>
          <DashboardPeriodFilter period={period} onChange={onPeriodChange} />
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-4">
          <div className="min-w-0"><dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><IconArrowUpRight aria-hidden className="size-3.5" />Money in</dt><dd className="text-base font-semibold sm:text-xl"><Money amount={inflow} tone="positive" signed /></dd></div>
          <div className="min-w-0 border-l border-border/60 pl-4"><dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><IconArrowDownRight aria-hidden className="size-3.5" />Money out</dt><dd className="text-base font-semibold sm:text-xl"><Money amount={outflow} tone="negative" signed /></dd></div>
        </dl>
      </div>
    </section>
  );
}

const presentationByType: Record<
  TransactionType,
  { icon: typeof IconArrowUpRight; iconClass: string; tone: "positive" | "negative" | "neutral"; signed: boolean }
> = {
  income: { icon: IconArrowUpRight, iconClass: "bg-pos/12 text-pos", tone: "positive", signed: true },
  expense: { icon: IconArrowDownRight, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  debt_payment: { icon: IconReceipt2, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  savings_contribution: {
    icon: IconPigMoney,
    iconClass: "bg-pos/12 text-pos",
    tone: "positive",
    signed: false,
  },
  transfer: {
    icon: IconArrowsExchange,
    iconClass: "bg-muted text-muted-foreground",
    tone: "neutral",
    signed: true,
  },
};

// Three rows, not a ledger. Each one opens the record it names on the
// transactions page, so the preview is a way in rather than a dead end.
export function DashboardRecentActivity({
  transactions,
  accounts,
  categories,
  counterparties,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  counterparties: Counterparty[];
}) {
  const recent = transactions.slice(0, RECENT_COUNT);
  const partyById = counterpartiesById(counterparties);

  return (
    <section aria-labelledby="recent-activity" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="recent-activity" className="text-base font-semibold">Recent activity</h2>
        <Link
          href="/transactions"
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
      <div>
        {recent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing recorded yet. Use Add to record your first transaction.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {recent.map((transaction) => {
              const account = accounts.find((entry) => entry.id === transaction.accountId);
              const category = categories.find((entry) => entry.id === transaction.categoryId);
              const presentation = presentationByType[transaction.type];
              const Icon = presentation.icon;
              const title =
                partyNameFor(transaction, partyById) ??
                category?.name ??
                transactionTypeLabels[transaction.type];

              return (
                <li key={transaction.id}>
                  <Link
                    href={`/transactions?transaction=${transaction.id}`}
                    className="-mx-3 flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span
                      aria-hidden
                      className={`grid size-8 shrink-0 place-items-center rounded-full ${presentation.iconClass}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(transaction.occurredOn)}
                        {account ? ` · ${account.name}` : ""}
                      </span>
                    </span>
                    <Money
                      amount={transaction.amount}
                      currency="UGX"
                      symbol="short"
                      tone={presentation.tone}
                      signed={presentation.signed}
                      className="max-w-[48%] text-right text-sm font-semibold tabular-nums"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DashboardPlanPreview({ preview, budgetCoverage, budgetCount }: {
  preview: PlanPreview;
  budgetCoverage: { allocated: number; spent: number; remaining: number };
  budgetCount: number;
}) {
  const over = budgetCoverage.remaining < 0;
  return (
    <section aria-labelledby="monthly-plan-heading" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="monthly-plan-heading" className="text-base font-semibold">Your month</h2>
        <Link href="/plan" className="inline-flex min-h-11 items-center text-xs font-medium text-primary">View plan <IconChevronRight aria-hidden className="ml-1 size-3.5" /></Link>
      </div>
      <div className="divide-y divide-border/60">
        <Link href="/plan?section=budgets" className="group flex min-w-0 items-center justify-between gap-3 py-3">
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{budgetCount ? over ? "Over budget" : "Budget remaining" : "Set your first budget"}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{budgetCount ? `Across ${budgetCount} budgeted ${budgetCount === 1 ? "category" : "categories"} · this month` : "Give this month’s spending a limit."}</span></span>
          {budgetCount > 0 ? <Money amount={Math.abs(budgetCoverage.remaining)} symbol="short" tone={over ? "negative" : "neutral"} className="max-w-[45%] text-right text-sm font-semibold" /> : null}
          <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <Link href="/plan?section=bills" className="group flex min-w-0 items-center justify-between gap-3 py-3">
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Bills to pay</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{preview.nextBill ? `${preview.nextBill.name} ${describeBillTiming(preview.nextBill.daysLeft)}` : preview.billsOutstanding > 0 ? `${preview.billsOutstanding} unpaid this month` : preview.hasBills ? "All tracked bills paid this month" : "Add rent, subscriptions or another bill."}</span></span>
          {preview.hasBills ? <Money amount={preview.outstandingAmount} symbol="short" className="max-w-[45%] text-right text-sm font-semibold" /> : null}
          <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </section>
  );
}

export function DashboardCoverSummary({ cover }: { cover: CoverStatus }) {
  const hasCover = cover.months !== null;
  const months = cover.months ?? 0;
  const progress = Math.min(100, Math.max(0, months / cover.targetMonths * 100));
  return (
    <section aria-labelledby="buffer-heading" className="min-w-0 rounded-xl bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="buffer-heading" className="text-sm font-semibold">Your buffer</h2>
        <span className="text-xs text-muted-foreground">Target: {cover.targetMonths} months</span>
      </div>
      {hasCover ? <>
        <p className="mt-2 text-sm"><span className="font-display text-2xl font-semibold tracking-tight">{months >= 100 ? "99+" : months.toFixed(1)}</span> <span className="text-muted-foreground">months covered</span></p>
        <div role="progressbar" aria-label="Emergency buffer" aria-valuemin={0} aria-valuemax={cover.targetMonths} aria-valuenow={Math.min(months, cover.targetMonths)} aria-valuetext={`${months.toFixed(1)} months covered; target ${cover.targetMonths}`} className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Based on average monthly spending.</p>
      </> : <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A little more history first. Your buffer estimate appears once there’s enough recorded spending.</p>}
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary">{hasCover ? "See calculation" : "What counts toward your buffer?"}<IconChevronRight aria-hidden className="size-3.5" /></summary>
        <div className="grid gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
          <p>{cover.basis}</p>
          <p>Liquid balances: <Money amount={cover.reserves} signed={cover.reserves < 0} tone="neutral" />{hasCover ? <> · Average monthly spending: <Money amount={cover.monthlySpend} /></> : null}</p>
          <p>This estimate uses recorded cash, mobile money and bank balances. It does not subtract upcoming bills or money you have earmarked for goals.</p>
          <Link href="/goals" className="inline-flex min-h-11 items-center font-medium text-primary">View your savings goals <IconChevronRight aria-hidden className="ml-1 size-3.5" /></Link>
        </div>
      </details>
    </section>
  );
}
