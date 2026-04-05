"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { applyGoalTransactions, getGoalContributionPlan } from "@/lib/domain/goals";
import { getMonthSummary } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Goal, GoalType, Transaction, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const repositories = createIndexedDbRepositories();

type GoalFormState = {
  name: string;
  goalType: GoalType;
  targetAmount: string;
  targetDate: string;
  priority: string;
  linkedAccountId: string;
};

const defaultGoalForm: GoalFormState = {
  name: "",
  goalType: "emergency_fund",
  targetAmount: "",
  targetDate: "",
  priority: "1",
  linkedAccountId: "",
};

function buildTimestamp() {
  return new Date().toISOString();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function sortGoals(goals: Goal[]) {
  return [...goals].sort((a, b) => a.priority - b.priority);
}

const goalTypeLabels: Record<GoalType, string> = {
  emergency_fund: "Emergency Fund",
  rent_buffer: "Rent Buffer",
  school_fees: "School Fees",
  land_savings: "Land Savings",
  business_capital: "Business Capital",
  education: "Education",
  house_construction: "House / Construction",
};

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
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load goals.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  const currentMonth = getCurrentMonth();
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
      const timestamp = buildTimestamp();
      const goalId = editingGoalId ?? `goal:${crypto.randomUUID()}`;

      const nextGoal: Goal = {
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
      };

      await repositories.goals.upsert(nextGoal);
      setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
      setEditingGoalId(null);
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save goal.",
      );
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
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete goal.",
      );
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
          <Card className="border-border/40 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {editingGoalId ? "Edit goal" : "New goal"}
              </CardTitle>
              <CardDescription>
                {goalForm.goalType === "emergency_fund"
                  ? `Suggested target based on 3x monthly outflow: ${formatCurrency(emergencyFundSuggestion)}`
                  : "Set a target amount and deadline for this goal."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleGoalSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="goal-name">Goal name</Label>
                  <Input
                    id="goal-name"
                    value={goalForm.name}
                    onChange={(e) => setGoalForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Emergency savings"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="goal-type">Goal type</Label>
                  <Select
                    value={goalForm.goalType}
                    onValueChange={(value) =>
                      setGoalForm((c) => ({ ...c, goalType: value as GoalType }))
                    }
                  >
                    <SelectTrigger id="goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultGoalTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {goalTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="target-amount">Target amount (UGX)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="target-amount"
                      inputMode="decimal"
                      value={goalForm.targetAmount}
                      onChange={(e) =>
                        setGoalForm((c) => ({ ...c, targetAmount: e.target.value }))
                      }
                      required
                    />
                    {goalForm.goalType === "emergency_fund" && emergencyFundSuggestion > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() =>
                          setGoalForm((c) => ({
                            ...c,
                            targetAmount: String(Math.round(emergencyFundSuggestion)),
                          }))
                        }
                      >
                        Use suggested
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="target-date">Target date</Label>
                  <Input
                    id="target-date"
                    type="date"
                    value={goalForm.targetDate}
                    onChange={(e) =>
                      setGoalForm((c) => ({ ...c, targetDate: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="goal-priority">Priority (1 = highest)</Label>
                  <Input
                    id="goal-priority"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={goalForm.priority}
                    onChange={(e) =>
                      setGoalForm((c) => ({ ...c, priority: e.target.value }))
                    }
                    required
                  />
                </div>

                {accounts.length > 0 ? (
                  <div className="grid gap-2">
                    <Label htmlFor="linked-account">Linked savings account</Label>
                    <Select
                      value={goalForm.linkedAccountId || "__none__"}
                      onValueChange={(value) =>
                        setGoalForm((c) => ({
                          ...c,
                          linkedAccountId: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="linked-account">
                        <SelectValue placeholder="Any account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Any account</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button disabled={isSubmitting} type="submit" size="sm">
                    {isSubmitting
                      ? "Saving..."
                      : editingGoalId
                        ? "Update goal"
                        : "Create goal"}
                  </Button>
                  {editingGoalId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingGoalId(null);
                        setGoalForm({ ...defaultGoalForm, linkedAccountId: accounts[0]?.id ?? "" });
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Your goals</CardTitle>
              <CardDescription>
                Monthly contribution targets are calculated from target, deadline, and current progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {goals.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                  No goals yet. Create your first goal to start building.
                </div>
              ) : (
                goals.map((goal) => {
                  const plan = getGoalContributionPlan(goal);
                  const linkedAccount = accounts.find((a) => a.id === goal.linkedAccountId);
                  const progressPercent =
                    goal.targetAmount > 0
                      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                      : 0;

                  return (
                    <Card
                      key={goal.id}
                      className="border-border/40 bg-muted/30 shadow-none"
                    >
                      <CardContent className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-foreground">
                              {goal.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {goalTypeLabels[goal.goalType]}
                              {linkedAccount ? ` · ${linkedAccount.name}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => beginGoalEdit(goal)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteGoal(goal.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(goal.currentAmount)}</span>
                            <span>{progressPercent}% of {formatCurrency(goal.targetAmount)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Monthly target</div>
                            <div className="font-medium tabular-nums">
                              {formatCurrency(plan.monthlyContribution)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Deadline</div>
                            <div className="font-medium">{goal.targetDate}</div>
                          </div>
                        </div>

                        {plan.isBehindSchedule ? (
                          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                            This goal is behind schedule — increase contributions to stay on track.
                          </p>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {plan.monthsRemaining} month{plan.monthsRemaining !== 1 ? "s" : ""} remaining.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
