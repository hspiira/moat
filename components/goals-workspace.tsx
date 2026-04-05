"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { applyGoalTransactions, getGoalContributionPlan } from "@/lib/domain/goals";
import { getMonthSummary } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Goal, GoalType, Transaction, UserProfile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  return [...goals].sort((left, right) => left.priority - right.priority);
}

function labelGoalType(goalType: GoalType) {
  return goalType.replaceAll("_", " ");
}

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
      setGoalForm((current) => ({
        ...current,
        linkedAccountId: current.linkedAccountId || reconciledAccounts[0]?.id || "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load goals workspace.",
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
  const emergencyFundGoal = goals.find((goal) => goal.goalType === "emergency_fund") ?? null;

  async function handleGoalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

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
        currentAmount: goals.find((goal) => goal.id === goalId)?.currentAmount ?? 0,
        targetDate: goalForm.targetDate,
        priority: Number(goalForm.priority),
        linkedAccountId: goalForm.linkedAccountId || undefined,
        createdAt: goals.find((goal) => goal.id === goalId)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      await repositories.goals.upsert(nextGoal);
      setGoalForm({
        ...defaultGoalForm,
        linkedAccountId: accounts[0]?.id ?? "",
      });
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
        setGoalForm({
          ...defaultGoalForm,
          linkedAccountId: accounts[0]?.id ?? "",
        });
      }
      await loadWorkspace();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasSetup = Boolean(profile);

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Issue #8
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Goals and emergency fund planning
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                This route now tracks target-based goals, calculates monthly
                contribution plans, and treats the emergency fund as the first
                financial moat priority.
              </p>
            </div>
          </div>

          <Card className="border-border/70 bg-muted/35 shadow-none">
            <CardHeader>
              <Badge variant="outline" className="w-fit bg-background/70">
                Emergency fund
              </Badge>
              <CardTitle>
                {emergencyFundGoal
                  ? formatCurrency(emergencyFundGoal.currentAmount)
                  : "No emergency fund goal yet"}
              </CardTitle>
              <CardDescription className="leading-7">
                Suggested emergency fund target based on this month&apos;s tracked
                outflow: {formatCurrency(emergencyFundSuggestion)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>Tracked goals: {goals.length}</div>
              <div>Saved accounts available: {accounts.length}</div>
              <div>Current month outflow: {formatCurrency(monthlySummary.outflow)}</div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-6 py-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {!hasSetup && !isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm leading-7 text-muted-foreground">
            Complete onboarding and record some account or transaction data before
            setting goals.
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading goals workspace...
          </CardContent>
        </Card>
      ) : null}

      {hasSetup && !isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle>{editingGoalId ? "Edit goal" : "Create goal"}</CardTitle>
              <CardDescription className="leading-7">
                Goals persist through the repository layer and progress is hydrated
                from savings contribution transactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleGoalSubmit}>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Goal name</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={goalForm.name}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Goal type</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={goalForm.goalType}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        goalType: event.target.value as GoalType,
                      }))
                    }
                  >
                    {defaultGoalTypes.map((goalType) => (
                      <option key={goalType} value={goalType}>
                        {labelGoalType(goalType)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Target amount</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    inputMode="decimal"
                    value={goalForm.targetAmount}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        targetAmount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Target date</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    type="date"
                    value={goalForm.targetDate}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        targetDate: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Priority</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={goalForm.priority}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Linked savings account</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={goalForm.linkedAccountId}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        linkedAccountId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Any account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting
                      ? "Saving..."
                      : editingGoalId
                        ? "Update goal"
                        : "Create goal"}
                  </Button>
                  {goalForm.goalType === "emergency_fund" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setGoalForm((current) => ({
                          ...current,
                          targetAmount: String(Math.round(emergencyFundSuggestion)),
                        }))
                      }
                    >
                      Use suggested emergency target
                    </Button>
                  ) : null}
                  {editingGoalId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingGoalId(null);
                        setGoalForm({
                          ...defaultGoalForm,
                          linkedAccountId: accounts[0]?.id ?? "",
                        });
                      }}
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle>Goal plans</CardTitle>
              <CardDescription className="leading-7">
                Monthly contribution targets are recalculated from the saved goal
                definition and current savings-linked progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {goals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                  No goals created yet.
                </div>
              ) : (
                goals.map((goal) => {
                  const plan = getGoalContributionPlan(goal);
                  const linkedAccount = accounts.find(
                    (account) => account.id === goal.linkedAccountId,
                  );

                  return (
                    <Card key={goal.id} className="border-border/70 bg-muted/35 shadow-none">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{labelGoalType(goal.goalType)}</Badge>
                              <span className="text-sm font-medium text-foreground">
                                {goal.name}
                              </span>
                            </div>
                            <CardDescription className="leading-6">
                              Priority {goal.priority}
                              {linkedAccount ? ` • ${linkedAccount.name}` : " • any savings account"}
                            </CardDescription>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => beginGoalEdit(goal)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleDeleteGoal(goal.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>
                          <div className="font-medium text-foreground">Current progress</div>
                          <div>
                            {formatCurrency(goal.currentAmount)} of{" "}
                            {formatCurrency(goal.targetAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">Monthly target</div>
                          <div>{formatCurrency(plan.monthlyContribution)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">Remaining amount</div>
                          <div>{formatCurrency(plan.remainingAmount)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">Target date</div>
                          <div>{goal.targetDate}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <Separator className="mb-3" />
                          {plan.isBehindSchedule
                            ? "This goal is close to its deadline and needs immediate attention."
                            : `${plan.monthsRemaining} month(s) remain to reach this goal.`}
                        </div>
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
