"use client";

import type { Account, GoalType } from "@/lib/types";
import { formatMoney } from "@/lib/currency";
import { DatePickerField } from "@/components/forms/date-picker-field";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { SelectField } from "@/components/forms/select-field";
import { accountOptions, optionsFromRecord } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type GoalFormState = {
  name: string;
  goalType: GoalType;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  priority: string;
  linkedAccountId: string;
};

export const defaultGoalForm: GoalFormState = {
  name: "",
  goalType: "emergency_fund",
  targetAmount: "",
  currentAmount: "0",
  targetDate: "",
  priority: "1",
  linkedAccountId: "",
};

export const goalTypeLabels: Record<GoalType, string> = {
  emergency_fund: "Emergency Fund",
  rent_buffer: "Rent Buffer",
  school_fees: "School Fees",
  land_savings: "Land Savings",
  business_capital: "Business Capital",
  education: "Education",
  house_construction: "House / Construction",
};

type Props = {
  accounts: Account[];
  goalTypes: GoalType[];
  form: GoalFormState;
  editingId: string | null;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  emergencyFundSuggestion: number;
  fieldErrors?: {
    name?: string;
    targetAmount?: string;
    currentAmount?: string;
    targetDate?: string;
    priority?: string;
  };
  onFormChange: (updater: (prev: GoalFormState) => GoalFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  /** When true, render as a full-bleed sheet form (no card border). */
  embedded?: boolean;
};

export function GoalForm({
  accounts,
  goalTypes,
  form,
  editingId,
  isSubmitting,
  lastSavedAt,
  successMessage,
  emergencyFundSuggestion,
  fieldErrors,
  onFormChange,
  onSubmit,
  onCancelEdit,
  embedded,
}: Props) {
  const title = editingId ? "Edit goal" : "New goal";
  const description =
    form.goalType === "emergency_fund"
      ? `Suggested target based on 3x monthly outflow: ${formatMoney(emergencyFundSuggestion, "UGX")}`
      : "Set a target amount and deadline for this goal.";

  const showSuggestion = form.goalType === "emergency_fund" && emergencyFundSuggestion > 0;

  const content = (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          {embedded ? null : (
            <LocalSaveFeedback
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
            />
          )}

          <InputField
            id="goal-name"
            label="Goal name"
            value={form.name}
            onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Emergency savings"
            error={fieldErrors?.name}
            autoFocus
          />

          <SelectField
            id="goal-type"
            label="Goal type"
            value={form.goalType}
            options={optionsFromRecord(goalTypeLabels, goalTypes)}
            onValueChange={(value) =>
              onFormChange((c) => ({ ...c, goalType: value as GoalType }))
            }
          />

          <div className="grid gap-2">
            <Label htmlFor="target-amount">Target amount (UGX)</Label>
            <div className="flex gap-2">
              <Input
                id="target-amount"
                inputMode="decimal"
                value={form.targetAmount}
                onChange={(e) => onFormChange((c) => ({ ...c, targetAmount: e.target.value }))}
                aria-invalid={fieldErrors?.targetAmount ? true : undefined}
                className={fieldErrors?.targetAmount ? "border-destructive" : undefined}
              />
              {showSuggestion ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() =>
                    onFormChange((c) => ({
                      ...c,
                      targetAmount: String(Math.round(emergencyFundSuggestion)),
                    }))
                  }
                >
                  Use suggested
                </Button>
              ) : null}
            </div>
            {fieldErrors?.targetAmount ? (
              <p className="text-xs text-destructive">{fieldErrors.targetAmount}</p>
            ) : null}
          </div>

          <InputField
            id="current-amount"
            label="Starting amount already saved (UGX)"
            inputMode="decimal"
            value={form.currentAmount}
            onChange={(e) => onFormChange((c) => ({ ...c, currentAmount: e.target.value }))}
            error={fieldErrors?.currentAmount}
          />

          <div className="grid gap-2">
            <DatePickerField
              id="target-date"
              label="Target date"
              value={form.targetDate}
              onChange={(v) => onFormChange((c) => ({ ...c, targetDate: v }))}
            />
            {fieldErrors?.targetDate ? (
              <p className="text-xs text-destructive">{fieldErrors.targetDate}</p>
            ) : null}
          </div>

          <InputField
            id="goal-priority"
            label="Priority (1 = highest)"
            inputMode="numeric"
            value={form.priority}
            onChange={(e) => onFormChange((c) => ({ ...c, priority: e.target.value }))}
            error={fieldErrors?.priority}
          />

          {accounts.length > 0 ? (
            <SelectField
              id="linked-account"
              label="Linked savings account"
              value={form.linkedAccountId || "__none__"}
              placeholder="Any account"
              options={[{ value: "__none__", label: "Any account" }, ...accountOptions(accounts)]}
              onValueChange={(value) =>
                onFormChange((c) => ({
                  ...c,
                  linkedAccountId: value === "__none__" ? "" : value,
                }))
              }
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit" size="sm">
              {isSubmitting ? "Saving..." : editingId ? "Update goal" : "Create goal"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
    </form>
  );

  return (
    <FormCardShell embedded={embedded} title={title} description={description}>
      {content}
    </FormCardShell>
  );
}
