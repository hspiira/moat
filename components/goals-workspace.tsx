"use client";

import { IconPlus } from "@tabler/icons-react";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { useFormSheet } from "@/components/hooks/use-form-sheet";
import { MoatRing } from "@/components/moat/moat-ring";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppSectionHeading } from "@/components/app-page";
import { GoalForm } from "@/components/goals/goal-form";
import { GoalList } from "@/components/goals/goal-list";
import { InvestmentGuidanceSection } from "@/components/goals/investment-guidance-section";
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
      <PageHeader title="Goals" srOnlyTitle />

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
          <section className="grid gap-4">
            <AppSectionHeading
              title="Your goals"
              description="What you are saving towards, and how each one is tracking."
            />

            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground">Active goals</p>
              <p className="font-display text-3xl font-semibold tabular-nums">{goals.length}</p>
            </div>

            <Button onClick={openNewGoal} className="justify-self-start sm:px-6">
              <IconPlus />
              New goal
            </Button>

            <GoalList
              accounts={accounts}
              goals={goals}
              isSubmitting={isSubmitting}
              onEdit={openEditGoal}
              onDelete={(goalId) => void handleDeleteGoal(goalId)}
            />
          </section>

          <section className="grid gap-4">
            <AppSectionHeading
              title="Your emergency fund"
              description="The one goal worth having before any other."
            />

            {emergencyFundGoal && emergencyFundSuggestion > 0 ? (
              <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
                <MoatRing
                  value={emergencyProgress}
                  tone={emergencyProgress >= 1 ? "positive" : "moat"}
                  ariaLabel={`Emergency fund: ${emergencyPercent}% of the suggested moat`}
                  label={`${emergencyPercent}%`}
                  sublabel="of moat"
                  size={124}
                  thickness={10}
                  className="justify-self-center sm:justify-self-start"
                />
                <div className="min-w-0 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Suggested emergency fund
                  </p>
                  <div className="font-display text-3xl leading-[1.1] font-semibold tracking-tight">
                    <Money
                      amount={emergencyFundSuggestion}
                      tone="neutral"
                      className="font-display"
                    />
                  </div>
                  <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                    Roughly three months of your current spending.
                  </p>
                </div>
              </div>
            ) : (
              // A ring at nought says nothing you did not already know. What is
              // useful when there is no fund yet is the figure and a way to start.
              <div className="grid gap-3">
                <div className="min-w-0 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Aim for about
                  </p>
                  <div className="font-display text-3xl leading-[1.1] font-semibold tracking-tight">
                    <Money
                      amount={emergencyFundSuggestion}
                      tone="neutral"
                      className="font-display"
                    />
                  </div>
                  <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                    Roughly three months of your current spending. Nothing set aside for it yet.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={openNewGoal}
                  className="justify-self-start"
                >
                  Start an emergency fund
                </Button>
              </div>
            )}
          </section>

          <InvestmentGuidanceSection />

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
