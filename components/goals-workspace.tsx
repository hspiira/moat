"use client";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { formatMoney } from "@/lib/currency";
import { MoatRing } from "@/components/moat/moat-ring";
import { Money } from "@/components/ui/money";
import { Card, CardContent } from "@/components/ui/card";
import { GoalForm } from "@/components/goals/goal-form";
import { GoalList } from "@/components/goals/goal-list";
import { useGoalsWorkspace } from "@/components/goals/use-goals-workspace";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";

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

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Goals"
        description="Set targets, track progress, and build your financial moat."
        aside={
          emergencyFundGoal ? (
            <MetricChip
              value={formatMoney(emergencyFundGoal.currentAmount)}
              label="Emergency fund"
            />
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
                value={
                  emergencyFundSuggestion > 0 && emergencyFundGoal
                    ? emergencyFundGoal.currentAmount / emergencyFundSuggestion
                    : 0
                }
                tone={
                  emergencyFundGoal &&
                  emergencyFundSuggestion > 0 &&
                  emergencyFundGoal.currentAmount >= emergencyFundSuggestion
                    ? "positive"
                    : "moat"
                }
                ariaLabel={
                  emergencyFundGoal && emergencyFundSuggestion > 0
                    ? `Emergency fund: ${Math.round(
                        (emergencyFundGoal.currentAmount / emergencyFundSuggestion) * 100,
                      )}% of the suggested moat`
                    : "Emergency fund: no goal yet"
                }
                label={
                  emergencyFundGoal && emergencyFundSuggestion > 0
                    ? `${Math.min(
                        999,
                        Math.round(
                          (emergencyFundGoal.currentAmount / emergencyFundSuggestion) * 100,
                        ),
                      )}%`
                    : "—"
                }
                sublabel="of moat"
                size={124}
                thickness={10}
                className="justify-self-center sm:justify-self-start"
              />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Suggested emergency moat
                </p>
                <div className="font-display text-3xl leading-none font-semibold tracking-tight">
                  <Money amount={emergencyFundSuggestion} tone="neutral" className="font-display" />
                </div>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                  Based on three months of current outflow. Use it as a planning floor, not a
                  ceiling.
                </p>
              </div>
              <div className="space-y-0.5 sm:text-right">
                <p className="text-xs text-muted-foreground">Active goals</p>
                <p className="text-3xl font-semibold tabular-nums">{goals.length}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <GoalForm
              accounts={accounts}
              goalTypes={defaultGoalTypes}
              form={goalForm}
              editingId={editingGoalId}
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
              emergencyFundSuggestion={emergencyFundSuggestion}
              onFormChange={setGoalForm}
              onSubmit={(event) => void handleGoalSubmit(event)}
              onCancelEdit={cancelEdit}
            />

            <GoalList
              accounts={accounts}
              goals={goals}
              isSubmitting={isSubmitting}
              onEdit={beginGoalEdit}
              onDelete={(goalId) => void handleDeleteGoal(goalId)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
