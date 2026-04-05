"use client";

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
import { Separator } from "@/components/ui/separator";

import { goalTypeLabels } from "./goal-form";

/**
 * Format a numeric amount as a Ugandan shilling (UGX) currency string.
 *
 * @param amount - The numeric amount to format (in UGX).
 * @returns The formatted UGX currency string with no fractional digits
 */
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

/**
 * Renders a "Your goals" card that displays a list of goals or an empty-state when none exist.
 *
 * @param accounts - Available accounts used to resolve a goal's linked account name
 * @param goals - Goals to render inside the card
 * @param isSubmitting - When true, disables destructive actions (Delete)
 * @param onEdit - Callback invoked with a goal when the user clicks the Edit button
 * @param onDelete - Callback invoked with a goal id when the user clicks the Delete button
 * @returns A card element containing either an empty-state prompt or a list of goal cards with progress, monthly target, deadline, and action buttons
 */
export function GoalList({ accounts, goals, isSubmitting, onEdit, onDelete }: Props) {
  return (
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
              <Card key={goal.id} className="border-border/40 bg-muted/30 shadow-none">
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
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>
                        {progressPercent}% of {formatCurrency(goal.targetAmount)}
                      </span>
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
