"use client";

import type { BudgetTarget, Category } from "@/lib/types";
import { getBudgetEnvelopes } from "@/lib/domain/budgets";
import { AccentCardHeader } from "@/components/accent-card-header";
import { AmountIndicator } from "@/components/amount-indicator";
import { SelectField } from "@/components/forms/select-field";
import { categoryOptions } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  month: string;
  categories: Category[];
  budgets: BudgetTarget[];
  transactions: import("@/lib/types").Transaction[];
  form: {
    categoryId: string;
    targetAmount: string;
    rolloverAmount: string;
  };
  isSubmitting: boolean;
  onFormChange: (updater: (current: Props["form"]) => Props["form"]) => void;
  onSave: () => void;
};

export function BudgetManagerPanel({
  month,
  categories,
  budgets,
  transactions,
  form,
  isSubmitting,
  onFormChange,
  onSave,
}: Props) {
  const monthTransactions = transactions.filter((transaction) =>
    transaction.occurredOn.startsWith(month),
  );
  const envelopes = getBudgetEnvelopes(budgets, categories, monthTransactions);
  const expenseCategoryOptions = categoryOptions(
    categories.filter((category) => category.kind === "expense"),
  );

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="mint"
        title={`Budget envelopes · ${month}`}
        description="Set category limits, track remaining balances, and catch overspend early."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
          <div className="grid gap-2">
            <SelectField
              label="Category"
              value={form.categoryId}
              placeholder="Select category"
              options={expenseCategoryOptions}
              onValueChange={(value) =>
                onFormChange((current) => ({ ...current, categoryId: value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Allocated (UGX)</Label>
            <Input
              inputMode="numeric"
              value={form.targetAmount}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  targetAmount: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Rollover (UGX)</Label>
            <Input
              inputMode="numeric"
              value={form.rolloverAmount}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  rolloverAmount: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid items-end">
            <Button type="button" size="sm" disabled={isSubmitting} onClick={onSave}>
              Save budget
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {envelopes.length === 0 ? (
            <div className="border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">
              No budgets set for this month.
            </div>
          ) : (
            envelopes.map((envelope) => (
              <div
                key={envelope.categoryId}
                className={`grid gap-2 border px-4 py-3 ${
                  envelope.isOverspent
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border/20 bg-muted/15"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-foreground">{envelope.categoryName}</div>
                    <div className="text-xs text-muted-foreground">
                      Allocated {formatCurrency(envelope.allocated)} · Spent{" "}
                      {formatCurrency(envelope.spent)}
                    </div>
                  </div>
                  <AmountIndicator
                    tone={
                      envelope.remaining > 0
                        ? "positive"
                        : envelope.remaining < 0
                          ? "negative"
                          : "neutral"
                    }
                    sign={
                      envelope.remaining > 0
                        ? "positive"
                        : envelope.remaining < 0
                          ? "negative"
                          : "none"
                    }
                    value={formatCurrency(Math.abs(envelope.remaining))}
                    className="text-sm font-medium"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
