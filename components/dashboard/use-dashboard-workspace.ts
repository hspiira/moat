"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { getAttentionItems, getBillsDueSoon } from "@/lib/domain/attention";
import { getBudgetCoverage, getBudgetEnvelopes } from "@/lib/domain/budgets";
import { getSectionOf } from "@/lib/domain/capture-review";
import { getCoverStatus } from "@/lib/domain/cover";
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
import { getPlanPreview } from "@/lib/domain/plan-preview";
import { evaluateRecurringObligations } from "@/lib/domain/recurring";
import { getSavingsRate, getSummaryForTransactions } from "@/lib/domain/summaries";
import { usePersistedSelection } from "@/components/hooks/use-persisted-selection";
import { repositories } from "@/lib/repositories/instance";
import type {
  Account,
  BudgetTarget,
  Category,
  Counterparty,
  Goal,
  Item,
  Project,
  RecurringObligation,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";
import { currentMonthIso, todayIso } from "@/lib/today";

export function useDashboardWorkspace(profile: UserProfile) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [obligations, setObligations] = useState<RecurringObligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
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
        storedGoals,
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
        repositories.goals.listByUser(profile.id),
      ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
      setBudgets(storedBudgets);
      setObligations(storedObligations);
      setProjects(storedProjects);
      setCounterparties(storedCounterparties);
      setGoals(storedGoals);
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
        goals,
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
      goals,
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
  // Cover is deliberately blind to `period`: it asks how many months the
  // reserves would last, so it reads its own monthly baseline rather than
  // whatever window the chips happen to be showing.
  const cover = useMemo(
    () => getCoverStatus({ accounts, transactions, now: new Date() }),
    [accounts, transactions],
  );
  const obligationEvaluations = useMemo(
    () => evaluateRecurringObligations(obligations, monthTransactions, currentMonth),
    [obligations, monthTransactions, currentMonth],
  );
  const billsDueSoon = useMemo(
    () => getBillsDueSoon(obligationEvaluations, new Date()),
    [obligationEvaluations],
  );
  // Counts every budget, not the four the attention items look at, so "2
  // budgets are over" cannot quietly mean "2 of the first 4".
  const allEnvelopes = useMemo(
    () => getBudgetEnvelopes(budgets, categories, monthTransactions),
    [budgets, categories, monthTransactions],
  );
  const planPreview = useMemo(
    () =>
      getPlanPreview({
        evaluations: obligationEvaluations,
        envelopes: allEnvelopes,
        today: new Date(),
      }),
    [obligationEvaluations, allEnvelopes],
  );
  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((left, right) =>
          left.occurredOn === right.occurredOn
            ? right.createdAt.localeCompare(left.createdAt)
            : right.occurredOn.localeCompare(left.occurredOn),
        )
        .slice(0, 3),
    [transactions],
  );
  const attentionItems = useMemo(
    () => {
      const items = getAttentionItems({
        envelopes: allEnvelopes,
        billsDueSoon,
        reviewCount,
        insights: [],
      });
      // Urgent bills first, then captured entries and overspent budgets.
      return [...items.filter((item) => item.id.startsWith("bill-due:")),
        ...items.filter((item) => item.id === "capture-review"),
        ...items.filter((item) => item.id.startsWith("overspent:"))];
    },
    [allEnvelopes, billsDueSoon, reviewCount],
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
    cover,
    attentionItems,
    insights,
    chartLabel,
    chartSeries,
    budgetCoverage,
    budgetEnvelopes,
    planPreview,
    recentTransactions,
    topAccounts,
    inflowChange,
    outflowChange,
    budgets,
    transactions,
    accounts,
    categories,
    counterparties,
  };
}
