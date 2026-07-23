"use client";

import { IconPlus } from "@tabler/icons-react";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { useFormSheet } from "@/components/hooks/use-form-sheet";
import { MoatRing } from "@/components/moat/moat-ring";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GoalForm } from "@/components/goals/goal-form";
import { GoalList } from "@/components/goals/goal-list";
import { useGoalsWorkspace } from "@/components/goals/use-goals-workspace";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import type { Goal } from "@/lib/types";

export function GoalsWorkspace() {
  const {
    profile,
    accounts,
    goals,
    goalForm,
    editingGoalId,
    isLoading,
    isSubmitting,
    error,
    fieldErrors,
    lastSavedAt,
    successMessage,
    emergencyFundSuggestion,
    emergencyFundGoal,
    setGoalForm,
    handleGoalSubmit,
    beginGoalEdit,
    handleDeleteGoal,
    cancelEdit,
  } = useGoalsWorkspace();

  const formSheet = useFormSheet(cancelEdit);

  function openNewGoal() {
    formSheet.openForCreate();
  }

  function openEditGoal(goal: Goal) {
    formSheet.openForEdit(() => beginGoalEdit(goal));
  }

  const emergencyProgress =
    emergencyFundSuggestion > 0 && emergencyFundGoal
      ? emergencyFundGoal.currentAmount / emergencyFundSuggestion
      : 0;
  const emergencyPercent = Math.min(999, Math.round(emergencyProgress * 100));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Goals"
        description="Set targets, track progress, and build your financial moat."
        aside={
          profile ? (
            <Button size="lg" onClick={openNewGoal}>
              <IconPlus />
              New goal
            </Button>
          ) : null
        }
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading goals..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding before setting goals."
          href="/onboarding"
          cta="Set up your profile"
        />
      ) : null}

      {!isLoading && profile ? (
        <>
          <Card className="ring-1 ring-primary/15">
            <CardContent className="grid gap-6 px-5 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:px-7">
              <MoatRing
                value={emergencyProgress}
                tone={emergencyProgress >= 1 ? "positive" : "moat"}
                ariaLabel={
                  emergencyFundGoal && emergencyFundSuggestion > 0
                    ? `Emergency fund: ${emergencyPercent}% of the suggested moat`
                    : "Emergency fund: no goal yet"
                }
                label={emergencyFundGoal && emergencyFundSuggestion > 0 ? `${emergencyPercent}%` : "—"}
                sublabel="of moat"
                size={124}
                thickness={10}
                className="justify-self-center sm:justify-self-start"
              />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Suggested emergency fund
                </p>
                <div className="font-display text-3xl leading-none font-semibold tracking-tight">
                  <Money amount={emergencyFundSuggestion} tone="neutral" className="font-display" />
                </div>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                  Roughly three months of your current spending — a good starting target.
                </p>
              </div>
              <div className="space-y-0.5 sm:text-right">
                <p className="text-xs text-muted-foreground">Active goals</p>
                <p className="text-3xl font-semibold tabular-nums">{goals.length}</p>
              </div>
            </CardContent>
          </Card>

          <GoalList
            accounts={accounts}
            goals={goals}
            isSubmitting={isSubmitting}
            onEdit={openEditGoal}
            onDelete={(goalId) => void handleDeleteGoal(goalId)}
            onAdd={openNewGoal}
          />

          <Sheet open={formSheet.isOpen} onOpenChange={formSheet.onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
              <SheetHeader className="sr-only">
                <SheetTitle>{editingGoalId ? "Edit goal" : "New goal"}</SheetTitle>
                <SheetDescription>Set a savings target and deadline.</SheetDescription>
              </SheetHeader>
              <GoalForm
                embedded
                accounts={accounts}
                goalTypes={defaultGoalTypes}
                form={goalForm}
                editingId={editingGoalId}
                isSubmitting={isSubmitting}
                lastSavedAt={lastSavedAt}
                successMessage={successMessage}
                emergencyFundSuggestion={emergencyFundSuggestion}
                fieldErrors={fieldErrors}
                onFormChange={setGoalForm}
                onSubmit={async (event) => {
                  const ok = await handleGoalSubmit(event);
                  if (ok) {
                    formSheet.close();
                  }
                }}
                onCancelEdit={formSheet.close}
              />
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
