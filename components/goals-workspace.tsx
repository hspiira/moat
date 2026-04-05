"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { applyGoalTransactions } from "@/lib/domain/goals";
import { getMonthSummary } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Goal, Transaction, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

import { GoalForm, type GoalFormState, defaultGoalForm } from "./goals/goal-form";
import { GoalList } from "./goals/goal-list";

const repositories = createIndexedDbRepositories();

/**
 * Create a new array of goals sorted in ascending order by `priority`.
 *
 * @param goals - The goals to sort
 * @returns A new array containing the same goals sorted by `priority` from lowest to highest
 */
function sortGoals(goals: Goal[]) {
  return [...goals].sort((a, b) => a.priority - b.priority);
}

/**
 * Format a numeric amount as Ugandan Shilling (UGX) using the `en-UG` locale.
 *
 * @param amount - The numeric amount to format
 * @returns The formatted currency string in UGX with no fractional digits
 */
function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Renders the goals workspace UI and manages its state, data loading, and goal CRUD operations.
 *
 * Loads the current user profile, accounts, goals, and transactions; computes a monthly summary
 * and an emergency fund suggestion; and provides forms and handlers to create, edit, and delete goals.
 *
 * @returns The Goals workspace as a React element
 */
export function GoalsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goalForm, setGoalForm] = useState<GoalFormState>(defaultGoalForm);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (!nextProfile) {
        setAccounts([]);
        setGoals([]);
        setTransactions([]);
        return;
      }

      const [storedAccounts, storedGoals, storedTransactions] = await Promise.all([
        repositories.accounts.listByUser(nextProfile.id),
        repositories.goals.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
      ]);

      const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);
      const hydratedGoals = sortGoals(
        storedGoals.map((goal) => applyGoalTransactions(goal, storedTransactions)),
      );

      setAccounts(reconciledAccounts);
      setGoals(hydratedGoals);
      setTransactions(storedTransactions);
      setGoalForm((c) => ({
        ...c,
        linkedAccountId: c.linkedAccountId || reconciledAccounts[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load goals.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlySummary = useMemo(
    () => getMonthSummary(transactions, [], currentMonth),
    [currentMonth, transactions],
  );
  const emergencyFundSuggestion = monthlySummary.outflow * 3;
  const emergencyFundGoal = goals.find((g) => g.goalType === "emergency_fund") ?? null;

  async function handleGoalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const goalId = editingGoalId ?? `goal:${crypto.randomUUID()}`;

      await repositories.goals.upsert({
        id: goalId,
        userId: profile.id,
        name: goalForm.name.trim(),
        goalType: goalForm.goalType,
        targetAmount: Number(goalForm.targetAmount),
        currentAmount: goals.find((g) => g.id === goalId)?.currentAmount ?? 0,
        targetDate: goalForm.targetDate,
        priority: Number(goalForm.priority),
        linkedAccountId: goalForm.linkedAccountId || undefined,
        createdAt: goals.find((g) => g.id === goalId)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
      setEditingGoalId(null);
      await loadWorkspace();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginGoalEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      goalType: goal.goalType,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate,
      priority: String(goal.priority),
      linkedAccountId: goal.linkedAccountId ?? "",
    });
  }

  async function handleDeleteGoal(goalId: string) {
    setIsSubmitting(true);
    setError(null);

    try {
      await repositories.goals.remove(goalId);
      if (editingGoalId === goalId) {
        setEditingGoalId(null);
        setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
      }
      await loadWorkspace();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Set targets, track progress, and build your financial moat.
          </p>
        </div>
        {emergencyFundGoal ? (
          <Card className="border-border/40 bg-muted/30 shadow-none">
            <CardContent className="px-4 py-3 text-sm">
              <div className="text-xs text-muted-foreground">Emergency fund</div>
              <div className="font-medium tabular-nums">
                {formatCurrency(emergencyFundGoal.currentAmount)}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading goals...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Complete onboarding before setting goals.{" "}
            <a href="/onboarding" className="underline underline-offset-4 hover:text-foreground">
              Set up your profile
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile ? (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <GoalForm
            accounts={accounts}
            goalTypes={defaultGoalTypes}
            form={goalForm}
            editingId={editingGoalId}
            isSubmitting={isSubmitting}
            emergencyFundSuggestion={emergencyFundSuggestion}
            onFormChange={setGoalForm}
            onSubmit={(e) => void handleGoalSubmit(e)}
            onCancelEdit={() => {
              setEditingGoalId(null);
              setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
            }}
          />

          <GoalList
            accounts={accounts}
            goals={goals}
            isSubmitting={isSubmitting}
            onEdit={beginGoalEdit}
            onDelete={(id) => void handleDeleteGoal(id)}
          />
        </div>
      ) : null}
    </div>
  );
}
