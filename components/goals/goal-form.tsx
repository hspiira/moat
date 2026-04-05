"use client";

import type { Account, Goal, GoalType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type GoalFormState = {
  name: string;
  goalType: GoalType;
  targetAmount: string;
  targetDate: string;
  priority: string;
  linkedAccountId: string;
};

export const defaultGoalForm: GoalFormState = {
  name: "",
  goalType: "emergency_fund",
  targetAmount: "",
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

/**
 * Format a numeric amount as a Uganda Shilling currency string.
 *
 * @param amount - The numeric amount to format (in UGX)
 * @returns The formatted currency string using the `en-UG` locale, `UGX` currency, and no fractional digits
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
  goalTypes: GoalType[];
  form: GoalFormState;
  editingId: string | null;
  isSubmitting: boolean;
  emergencyFundSuggestion: number;
  onFormChange: (updater: (prev: GoalFormState) => GoalFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

/**
 * Render a card-based form for creating or editing a financial goal.
 *
 * Renders controlled inputs for name, goal type, target amount, target date,
 * priority, and an optional linked savings account. When the selected goal type
 * is `emergency_fund` and a positive `emergencyFundSuggestion` is provided,
 * displays a suggested target amount and a "Use suggested" action.
 *
 * @param accounts - Available savings accounts shown in the linked-account selector
 * @param goalTypes - Available goal types shown in the goal-type selector
 * @param form - Current controlled form state for all inputs
 * @param editingId - Truthy value when editing an existing goal (affects title and submit label)
 * @param isSubmitting - Disables the submit button and changes its label while submitting
 * @param emergencyFundSuggestion - Numeric suggestion used to prefill the target amount for emergency funds
 * @param onFormChange - Functional updater used to change form state
 * @param onSubmit - Form submit handler
 * @param onCancelEdit - Handler invoked to cancel edit mode
 * @returns The rendered JSX element for the goal form
 */
export function GoalForm({
  accounts,
  goalTypes,
  form,
  editingId,
  isSubmitting,
  emergencyFundSuggestion,
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  const showSuggestion =
    form.goalType === "emergency_fund" && emergencyFundSuggestion > 0;

  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">
          {editingId ? "Edit goal" : "New goal"}
        </CardTitle>
        <CardDescription>
          {form.goalType === "emergency_fund"
            ? `Suggested target based on 3x monthly outflow: ${formatCurrency(emergencyFundSuggestion)}`
            : "Set a target amount and deadline for this goal."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input
              id="goal-name"
              value={form.name}
              onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Emergency savings"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-type">Goal type</Label>
            <Select
              value={form.goalType}
              onValueChange={(value) =>
                onFormChange((c) => ({ ...c, goalType: value as GoalType }))
              }
            >
              <SelectTrigger id="goal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {goalTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {goalTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="target-amount">Target amount (UGX)</Label>
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

          <div className="grid gap-2">
            <Label htmlFor="target-date">Target date</Label>
            <DatePicker
              id="target-date"
              value={form.targetDate}
              onChange={(v) => onFormChange((c) => ({ ...c, targetDate: v }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-priority">Priority (1 = highest)</Label>
            <Input
              id="goal-priority"
              inputMode="numeric"
              min="1"
              max="10"
              value={form.priority}
              onChange={(e) => onFormChange((c) => ({ ...c, priority: e.target.value }))}
              required
            />
          </div>

          {accounts.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="linked-account">Linked savings account</Label>
              <Select
                value={form.linkedAccountId || "__none__"}
                onValueChange={(value) =>
                  onFormChange((c) => ({
                    ...c,
                    linkedAccountId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="linked-account">
                  <SelectValue placeholder="Any account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
