"use client";

import type { Account, GoalType } from "@/lib/types";
import { AccentCardHeader } from "@/components/accent-card-header";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
            ? `Suggested target based on 3x monthly outflow: ${formatCurrency(emergencyFundSuggestion)}`
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
