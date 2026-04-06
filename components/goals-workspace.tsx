"use client";

import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { AmountIndicator } from "@/components/amount-indicator";
import { formatMoney } from "@/lib/currency";
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
          <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
            <Card className="moat-panel-mint border-border/20 shadow-none">
              <CardContent className="grid gap-3 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">
                  Suggested emergency moat
                </div>
                <AmountIndicator
                  tone={emergencyFundSuggestion > 0 ? "positive" : "neutral"}
                  sign={emergencyFundSuggestion > 0 ? "positive" : "none"}
                  value={formatMoney(emergencyFundSuggestion)}
                  className="text-4xl font-semibold tracking-tight"
                />
                <p className="max-w-lg text-sm leading-6 text-foreground/75">
                  Based on three months of current outflow. Use it as a planning floor, not a ceiling.
                </p>
              </CardContent>
            </Card>
            <Card className="moat-panel-yellow border-border/20 shadow-none">
              <CardContent className="grid gap-2 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">
                  Active goals
                </div>
                <div className="text-4xl font-semibold tracking-tight">{goals.length}</div>
                <div className="text-sm text-foreground/75">
                  Prioritise buffers first, then longer-dated ambitions.
                </div>
              </CardContent>
            </Card>
          </div>

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
