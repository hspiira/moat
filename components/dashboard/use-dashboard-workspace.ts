"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { getAccountTotals, reconcileAccountBalances } from "@/lib/domain/accounts";
import { getAttentionItems, getHabitItems } from "@/lib/domain/attention";
import { getBudgetCoverage, getBudgetEnvelopes } from "@/lib/domain/budgets";
import { getSectionOf } from "@/lib/domain/capture-review";
import {
  buildPeriodWindow,
  buildDashboardChartSeries,
  getAggregateBalanceAtDate,
  getChangePercent,
  getPeriodChartLabel,
  type ChangeMetric,
  type PeriodFilter,
} from "@/lib/domain/dashboard";
import { getMonthlyInsights } from "@/lib/domain/insights";
import { getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import { usePersistedSelection } from "@/components/hooks/use-persisted-selection";
import { repositories } from "@/lib/repositories/instance";
import type { Account, BudgetTarget, Category, Transaction, UserProfile } from "@/lib/types";

const TARGET_COVER_MONTHS = 3;

export function useDashboardWorkspace(profile: UserProfile) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [period, setPeriod] = usePersistedSelection<PeriodFilter>(
    "moat.dashboard-period",
    "month",
    (value): value is PeriodFilter =>
      value === "week" || value === "month" || value === "year" || value === "all",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [
        storedAccounts,
        storedCategories,
        storedTransactions,
        storedBudgets,
        storedReviewItems,
      ] = await Promise.all([
        repositories.accounts.listByUser(profile.id),
        repositories.categories.listByUser(profile.id),
        repositories.transactions.listByUser(profile.id),
        repositories.budgets.listByMonth(profile.id, currentMonth),
        repositories.captureReviewItems.listByUser(profile.id),
      ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
      setBudgets(storedBudgets);
      setReviewCount(
        storedReviewItems.filter((item) => getSectionOf(item) === "to_review").length,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load dashboard. Please try again.");
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
  const chartSeries = useMemo(
    () => buildDashboardChartSeries(transactions, categories, period, new Date()),
    [categories, period, transactions],
  );
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
  const { totalBalance } = useMemo(() => getAccountTotals(accounts), [accounts]);
  const coverMonths = summary.outflow > 0 && totalBalance > 0 ? totalBalance / summary.outflow : 0;
  const attentionItems = useMemo(
    () =>
      getAttentionItems({
        envelopes: budgetEnvelopes,
        reviewCount,
        insights,
        habits: getHabitItems({
          savingsRate,
          hasIncome: summary.inflow > 0,
          coverMonths,
          targetCoverMonths: TARGET_COVER_MONTHS,
        }),
      }),
    [budgetEnvelopes, reviewCount, insights, savingsRate, summary.inflow, coverMonths],
  );
  const topAccounts = useMemo(
    () =>
      [...accounts]
        .filter((account) => !account.isArchived)
        .sort((left, right) => right.balance - left.balance)
        .slice(0, 4),
    [accounts],
  );

  // Only show period-over-period deltas when the prior window actually had
  // activity. Otherwise every tile reads "New", which is noise, not a signal.
  const hasComparablePrevious = previousTransactions.length > 0;
  const noChange: ChangeMetric = { kind: "none", value: null };
  const inflowChange = hasComparablePrevious
    ? getChangePercent(summary.inflow, previousSummary.inflow)
    : noChange;
  const outflowChange = hasComparablePrevious
    ? getChangePercent(summary.outflow, previousSummary.outflow)
    : noChange;


  return {
    period,
    setPeriod,
    isLoading,
    error,
    periodWindow,
    summary,
    savingsRate,
    attentionItems,
    chartLabel,
    chartSeries,
    budgetCoverage,
    budgetEnvelopes,
    topAccounts,
    inflowChange,
    outflowChange,
    budgets,
    transactions,
    accounts,
    categories,
  };
}
