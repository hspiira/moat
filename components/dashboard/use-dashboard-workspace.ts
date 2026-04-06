"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { modulePreviews } from "@/lib/data";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { getBudgetCoverage, getBudgetEnvelopes } from "@/lib/domain/budgets";
import {
  buildPeriodWindow,
  getAggregateBalanceAtDate,
  getChangePercent,
  getPeriodChartLabel,
  type PeriodFilter,
} from "@/lib/domain/dashboard";
import { getMonthlyInsights } from "@/lib/domain/insights";
import { getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, BudgetTarget, Category, Transaction, UserProfile } from "@/lib/types";
import type { SummaryTile } from "@/components/dashboard/dashboard-summary-tiles";

const repositories = createIndexedDbRepositories();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function useDashboardWorkspace(profile: UserProfile) {
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
      const [storedAccounts, storedCategories, storedTransactions, storedBudgets] =
        await Promise.all([
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
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
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
  const topAccounts = useMemo(
    () =>
      [...accounts]
        .filter((account) => !account.isArchived)
        .sort((left, right) => right.balance - left.balance)
        .slice(0, 4),
    [accounts],
  );

  const inflowChange = getChangePercent(summary.inflow, previousSummary.inflow);
  const outflowChange = getChangePercent(summary.outflow, previousSummary.outflow);
  const savingsChange = getChangePercent(summary.savings, previousSummary.savings);

  const summaryTiles: SummaryTile[] = [
    {
      label: "Inflow",
      value: formatCurrency(summary.inflow),
      className: "moat-panel-yellow",
      tone: summary.inflow > 0 ? "positive" : "neutral",
      sign: summary.inflow > 0 ? "positive" : "none",
      change: inflowChange,
      changeTone:
        inflowChange.kind === "none"
          ? "neutral"
          : inflowChange.kind === "new"
            ? "positive"
            : (inflowChange.value ?? 0) > 0
              ? "positive"
              : (inflowChange.value ?? 0) < 0
                ? "negative"
                : "neutral",
      changeDirection:
        inflowChange.kind === "none"
          ? "flat"
          : inflowChange.kind === "new"
            ? "up"
            : (inflowChange.value ?? 0) > 0
              ? "up"
              : (inflowChange.value ?? 0) < 0
                ? "down"
                : "flat",
    },
    {
      label: "Outflow",
      value: formatCurrency(summary.outflow),
      className: "moat-panel-lilac",
      tone: summary.outflow > 0 ? "negative" : "neutral",
      sign: summary.outflow > 0 ? "negative" : "none",
      change: outflowChange,
      changeTone:
        outflowChange.kind === "none"
          ? "neutral"
          : outflowChange.kind === "new"
            ? "negative"
            : (outflowChange.value ?? 0) < 0
              ? "positive"
              : (outflowChange.value ?? 0) > 0
                ? "negative"
                : "neutral",
      changeDirection:
        outflowChange.kind === "none"
          ? "flat"
          : outflowChange.kind === "new"
            ? "up"
            : (outflowChange.value ?? 0) < 0
              ? "down"
              : (outflowChange.value ?? 0) > 0
                ? "up"
                : "flat",
    },
    {
      label: "Saved",
      value: formatCurrency(summary.savings),
      className: "moat-panel-mint",
      tone: summary.savings > 0 ? "positive" : summary.savings < 0 ? "negative" : "neutral",
      sign: summary.savings > 0 ? "positive" : summary.savings < 0 ? "negative" : "none",
      change: savingsChange,
      changeTone:
        savingsChange.kind === "none"
          ? "neutral"
          : savingsChange.kind === "new"
            ? "positive"
            : (savingsChange.value ?? 0) > 0
              ? "positive"
              : (savingsChange.value ?? 0) < 0
                ? "negative"
                : "neutral",
      changeDirection:
        savingsChange.kind === "none"
          ? "flat"
          : savingsChange.kind === "new"
            ? "up"
            : (savingsChange.value ?? 0) > 0
              ? "up"
              : (savingsChange.value ?? 0) < 0
                ? "down"
                : "flat",
    },
  ];

  return {
    period,
    setPeriod,
    isLoading,
    error,
    periodWindow,
    summary,
    savingsRate,
    insights,
    chartLabel,
    budgetCoverage,
    budgetEnvelopes,
    topAccounts,
    summaryTiles,
    budgets,
    transactions,
    accounts,
    categories,
    modulePreviews,
  };
}
