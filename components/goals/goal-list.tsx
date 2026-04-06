"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import { getGoalContributionPlan } from "@/lib/domain/goals";
import type { Account, Goal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";

import { goalTypeLabels } from "./goal-form";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  accounts: Account[];
  goals: Goal[];
  isSubmitting: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
};

export function GoalList({ accounts, goals, isSubmitting, onEdit, onDelete }: Props) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Your goals</CardTitle>
        <CardDescription>Targets are calculated from amount, deadline, and progress.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {goals.length === 0 ? (
          <EmptyState>
            No goals yet. Create your first goal to start building.
          </EmptyState>
        ) : (
          goals.map((goal, index) => {
            const plan = getGoalContributionPlan(goal);
            const linkedAccount = accounts.find((a) => a.id === goal.linkedAccountId);
            const progressPercent =
              goal.targetAmount > 0
                ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
                : 0;

            return (
              <Card
                key={goal.id}
                className={`border-border/20 shadow-none ${
                  index === 0
                    ? "moat-panel-mint"
                    : index % 2 === 0
                      ? "moat-panel-sage"
                      : "bg-muted/20"
                }`}
              >
                <CardContent className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground">{goal.name}</div>
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
                        onClick={() => onEdit(goal)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={isSubmitting}
                        onClick={() => onDelete(goal.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <AmountIndicator
                        tone={goal.currentAmount > 0 ? "positive" : "neutral"}
                        sign={goal.currentAmount > 0 ? "positive" : "none"}
                        value={formatCurrency(goal.currentAmount)}
                      />
                      <span>
                        {progressPercent}% of {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Monthly target</div>
                      <AmountIndicator
                        tone={plan.isBehindSchedule ? "negative" : "neutral"}
                        sign={plan.isBehindSchedule ? "negative" : "none"}
                        value={formatCurrency(plan.monthlyContribution)}
                        className="font-medium"
                      />
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
                      {plan.monthsRemaining} month
                      {plan.monthsRemaining !== 1 ? "s" : ""} remaining.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
