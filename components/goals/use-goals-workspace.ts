"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { defaultGoalForm, type GoalFormState } from "@/components/goals/goal-form";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { announceLocalSave } from "@/lib/local-save";
import { getMonthSummary } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Goal, Transaction, UserProfile } from "@/lib/types";

const repositories = createIndexedDbRepositories();

function sortGoals(goals: Goal[]) {
  return [...goals].sort((left, right) => left.priority - right.priority);
}

export function useGoalsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goalForm, setGoalForm] = useState<GoalFormState>(defaultGoalForm);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const hydratedGoals = sortGoals(storedGoals);

      setAccounts(reconciledAccounts);
      setGoals(hydratedGoals);
      setTransactions(storedTransactions);
      setGoalForm((current) => ({
        ...current,
        linkedAccountId: current.linkedAccountId || reconciledAccounts[0]?.id || "",
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
  const emergencyFundGoal = goals.find((goal) => goal.goalType === "emergency_fund") ?? null;

  async function handleGoalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const goalId = editingGoalId ?? `goal:${crypto.randomUUID()}`;
      const wasEditing = Boolean(editingGoalId);

      await repositories.goals.upsert({
        id: goalId,
        userId: profile.id,
        name: goalForm.name.trim(),
        goalType: goalForm.goalType,
        targetAmount: Number(goalForm.targetAmount),
        currentAmount: Number(goalForm.currentAmount),
        targetDate: goalForm.targetDate,
        priority: Number(goalForm.priority),
        linkedAccountId: goalForm.linkedAccountId || undefined,
        createdAt: goals.find((goal) => goal.id === goalId)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      const message = wasEditing ? "Goal updated locally" : "Goal saved locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "goals", savedAt: timestamp, message });
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
      currentAmount: String(goal.currentAmount),
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
      const timestamp = new Date().toISOString();
      const message = "Goal deleted locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "goals", savedAt: timestamp, message });
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

  function cancelEdit() {
    setEditingGoalId(null);
    setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
  }

  return {
    profile,
    accounts,
    goals,
    goalForm,
    editingGoalId,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    emergencyFundSuggestion,
    emergencyFundGoal,
    setGoalForm,
    handleGoalSubmit,
    beginGoalEdit,
    handleDeleteGoal,
    cancelEdit,
  };
}
