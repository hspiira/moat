"use client";

import { IconPencil, IconTrash } from "@tabler/icons-react";

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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirmDelete } from "@/components/hooks/use-confirm-delete";
import { MoatRing } from "@/components/moat/moat-ring";
import { Money } from "@/components/ui/money";
import { Separator } from "@/components/ui/separator";

import { goalTypeLabels } from "./goal-form";

type Props = {
  accounts: Account[];
  goals: Goal[];
  isSubmitting: boolean;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onAdd?: () => void;
};

export function GoalList({ accounts, goals, isSubmitting, onEdit, onDelete, onAdd }: Props) {
  const del = useConfirmDelete<Goal>((goal) => onDelete(goal.id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your goals</CardTitle>
        <CardDescription>Targets are calculated from amount, deadline, and progress.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {goals.length === 0 ? (
          <EmptyState>
            <p>No goals yet. Create your first goal to start building.</p>
            {onAdd ? (
              <Button size="sm" className="mt-3" onClick={onAdd}>
                New goal
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          goals.map((goal) => {
            const plan = getGoalContributionPlan(goal);
            const linkedAccount = accounts.find((a) => a.id === goal.linkedAccountId);
            const progressRatio =
              goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
            const progressPercent = Math.min(100, Math.round(progressRatio * 100));

            return (
              <div
                key={goal.id}
                className="-mx-4 rounded-none border-y border-border/60 bg-card px-4 py-4 sm:mx-0 sm:rounded-md sm:border-x"
              >
                <div className="flex items-center gap-3">
                  <MoatRing
                    value={progressRatio}
                    tone={progressRatio >= 1 ? "positive" : "moat"}
                    ariaLabel={`${goal.name}: ${progressPercent}% of target`}
                    label={`${progressPercent}%`}
                    size={56}
                    thickness={5}
                    className="shrink-0 [&_div]:text-xs"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{goal.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {goalTypeLabels[goal.goalType]}
                      {linkedAccount ? ` · ${linkedAccount.name}` : ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      aria-label={`Edit ${goal.name}`}
                      onClick={() => onEdit(goal)}
                    >
                      <IconPencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${goal.name}`}
                      className="size-9 text-muted-foreground hover:text-destructive"
                      disabled={isSubmitting}
                      onClick={() => del.request(goal, goal.name)}
                    >
                      <IconTrash />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <Money amount={goal.currentAmount} tone="positive" className="font-medium" />
                  <span className="whitespace-nowrap">
                    of <Money amount={goal.targetAmount} tone="muted" />
                  </span>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Monthly target</div>
                    <Money
                      amount={Math.round(plan.monthlyContribution / 1000) * 1000}
                      tone={plan.isBehindSchedule ? "negative" : "neutral"}
                      className="font-medium"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Deadline</div>
                    <div className="font-medium tabular-nums">{goal.targetDate}</div>
                  </div>
                </div>

                {plan.isBehindSchedule ? (
                  <p className="mt-3 text-xs font-medium text-clay">
                    A bit behind schedule for the deadline.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {plan.monthsRemaining} month
                    {plan.monthsRemaining !== 1 ? "s" : ""} remaining.
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
      <ConfirmDialog
        {...del.dialogProps}
        title="Delete this goal?"
        description={
          <>
            <span className="font-medium text-foreground">{del.label}</span>{" "}
            and its progress will be removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </Card>
  );
}
