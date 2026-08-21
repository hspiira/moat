"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { getAccountTotals, reconcileAccountBalances } from "@/lib/domain/accounts";
import { getAttentionItems, getBillsDueSoon, getHabitItems } from "@/lib/domain/attention";
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
import { evaluateRecurringObligations } from "@/lib/domain/recurring";
import { getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import { usePersistedSelection } from "@/components/hooks/use-persisted-selection";
import { repositories } from "@/lib/repositories/instance";
import type {
  Account,
  BudgetTarget,
  Category,
  Counterparty,
  Item,
  Project,
  RecurringObligation,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";
import { currentMonthIso, todayIso } from "@/lib/today";

const TARGET_COVER_MONTHS = 3;

export function useDashboardWorkspace(profile: UserProfile) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [obligations, setObligations] = useState<RecurringObligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
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
      const currentMonth = currentMonthIso();
      const [
        storedAccounts,
        storedCategories,
        storedTransactions,
        storedBudgets,
        storedReviewItems,
        storedObligations,
        storedProjects,
        storedCounterparties,
        storedItems,
        storedLineItems,
      ] = await Promise.all([
        repositories.accounts.listByUser(profile.id),
        repositories.categories.listByUser(profile.id),
        repositories.transactions.listByUser(profile.id),
        repositories.budgets.listByMonth(profile.id, currentMonth),
        repositories.captureReviewItems.listByUser(profile.id),
        repositories.recurringObligations.listByUser(profile.id),
        repositories.projects.listByUser(profile.id),
        repositories.counterparties.listByUser(profile.id),
        repositories.items.listByUser(profile.id),
        repositories.transactionLineItems.listByUser(profile.id),
      ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
      setBudgets(storedBudgets);
      setObligations(storedObligations);
      setProjects(storedProjects);
      setCounterparties(storedCounterparties);
      setItems(storedItems);
      setLineItems(storedLineItems);
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
    () =>
      getMonthlyInsights({
        summary,
        transactions: currentTransactions,
        previousTransactions,
        categories,
        accounts,
        projects,
        counterparties,
        trackedPayees: obligations.flatMap((obligation) =>
          [obligation.payee, obligation.name].filter((value): value is string => Boolean(value)),
        ),
        allTransactions: transactions,
        items,
        lineItems,
        today: todayIso(),
        now: new Date(),
        periodLabel: period,
      }),
    [
      accounts,
      categories,
      counterparties,
      currentTransactions,
      items,
      lineItems,
      obligations,
      period,
      previousTransactions,
      projects,
      summary,
      transactions,
    ],
  );
  const chartLabel = getPeriodChartLabel(period);
  const chartSeries = useMemo(
    () => buildDashboardChartSeries(transactions, categories, period, new Date()),
    [categories, period, transactions],
  );
  const currentMonth = currentMonthIso();
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
  const billsDueSoon = useMemo(
    () =>
      getBillsDueSoon(
        evaluateRecurringObligations(obligations, monthTransactions, currentMonth),
        new Date(),
      ),
    [obligations, monthTransactions, currentMonth],
  );
  const attentionItems = useMemo(
    () =>
      getAttentionItems({
        envelopes: budgetEnvelopes,
        billsDueSoon,
        reviewCount,
        insights,
        habits: getHabitItems({
          savingsRate,
          hasIncome: summary.inflow > 0,
          coverMonths,
          targetCoverMonths: TARGET_COVER_MONTHS,
        }),
      }),
    [budgetEnvelopes, billsDueSoon, reviewCount, insights, savingsRate, summary.inflow, coverMonths],
  );
  const topAccounts = useMemo(
    () =>
      [...accounts]
        .filter((account) => !account.isArchived)
        .sort((left, right) => right.balance - left.balance)
        .slice(0, 4),
    [accounts],
  );

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
