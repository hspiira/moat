"use client";

import { goalTypeLabels } from "@/components/goals/goal-form";
import { defaultGoalTypes } from "@/lib/app-state/defaults";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { optionsFromRecord } from "@/lib/select-options";
import type { GoalType } from "@/lib/types";

import type { GoalSetupState } from "./use-onboarding-workspace";

type Props = {
  goal: GoalSetupState;
  onGoalChange: (updater: (prev: GoalSetupState) => GoalSetupState) => void;
};

export function GoalStep({ goal, onGoalChange }: Props) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-4 py-3">
        <input
          id="goal-enabled"
          type="checkbox"
          checked={goal.enabled}
          onChange={(e) => onGoalChange((c) => ({ ...c, enabled: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <label
          htmlFor="goal-enabled"
          className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
        >
          Add my first goal now
        </label>
      </div>

      {goal.enabled ? (
        <>
          <InputField
            id="goal-name"
            label="Goal name"
            value={goal.name}
            onChange={(e) => onGoalChange((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Emergency savings"
            required
          />

          <SelectField
            id="goal-type"
            label="Goal type"
            value={goal.goalType}
            options={optionsFromRecord(goalTypeLabels, defaultGoalTypes)}
            onValueChange={(value) =>
              onGoalChange((c) => ({ ...c, goalType: value as GoalType }))
            }
          />

          <InputField
            id="goal-target-amount"
            label="Target amount (UGX)"
            inputMode="decimal"
            value={goal.targetAmount}
            onChange={(e) =>
              onGoalChange((c) => ({ ...c, targetAmount: e.target.value }))
            }
            placeholder="e.g. 500000"
            required
          />

          <InputField
            id="goal-target-date"
            type="date"
            label="Target date"
            value={goal.targetDate}
            onChange={(e) => onGoalChange((c) => ({ ...c, targetDate: e.target.value }))}
            required
          />
        </>
      ) : (
        <div className="rounded-md border border-border/30 px-4 py-3 text-sm text-muted-foreground">
          Skipping this is fine. You can add goals later once your first transactions are
          in.
        </div>
      )}
    </>
  );
}
