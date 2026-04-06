"use client";

import type { Account, GoalType } from "@/lib/types";
import { formatMoney } from "@/lib/currency";
import { AccentCardHeader } from "@/components/accent-card-header";
import { DatePickerField } from "@/components/forms/date-picker-field";
import { InputField } from "@/components/forms/input-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { SelectField } from "@/components/forms/select-field";
import { accountOptions, optionsFromRecord } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  onFormChange: (updater: (prev: GoalFormState) => GoalFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
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
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  const showSuggestion =
    form.goalType === "emergency_fund" && emergencyFundSuggestion > 0;

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title={editingId ? "Edit goal" : "New goal"}
        description={
          form.goalType === "emergency_fund"
            ? `Suggested target based on 3x monthly outflow: ${formatMoney(emergencyFundSuggestion, "UGX")}`
            : "Set a target amount and deadline for this goal."
        }
      />
      <CardContent className="p-5">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <LocalSaveFeedback
            isSubmitting={isSubmitting}
            lastSavedAt={lastSavedAt}
            successMessage={successMessage}
          />

          <InputField
            id="goal-name"
            label="Goal name"
            value={form.name}
            onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Emergency savings"
            required
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
            <div className="text-sm text-foreground">Target amount (UGX)</div>
            <div className="flex gap-2">
              <Input
                id="target-amount"
                inputMode="decimal"
                value={form.targetAmount}
                onChange={(e) => onFormChange((c) => ({ ...c, targetAmount: e.target.value }))}
                required
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
          </div>

          <InputField
            id="current-amount"
            label="Current amount saved (UGX)"
            inputMode="decimal"
            value={form.currentAmount}
            onChange={(e) => onFormChange((c) => ({ ...c, currentAmount: e.target.value }))}
            required
          />

          <DatePickerField
            id="target-date"
            label="Target date"
            value={form.targetDate}
            onChange={(v) => onFormChange((c) => ({ ...c, targetDate: v }))}
          />

          <InputField
            id="goal-priority"
            label="Priority (1 = highest)"
            inputMode="numeric"
            min="1"
            max="10"
            value={form.priority}
            onChange={(e) => onFormChange((c) => ({ ...c, priority: e.target.value }))}
            required
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
      </CardContent>
    </Card>
  );
}
