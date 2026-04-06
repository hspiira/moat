"use client";

import { formatMoney } from "@/lib/currency";
import type { BudgetTarget, Category, Transaction } from "@/lib/types";
import {
  getBudgetEnvelopes,
  getBudgetFundingCapacity,
  getIncomeFundingSummaries,
} from "@/lib/domain/budgets";
import { AccentCardHeader } from "@/components/accent-card-header";
import { AmountIndicator } from "@/components/amount-indicator";
import { SelectField } from "@/components/forms/select-field";
import { categoryOptions } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { InputField } from "@/components/forms/input-field";

type Props = {
  month: string;
  categories: Category[];
  budgets: BudgetTarget[];
  transactions: Transaction[];
  form: {
    budgetId: string | null;
    categoryId: string;
    targetAmount: string;
    rolloverAmount: string;
    incomeTransactionId: string;
  };
  isSubmitting: boolean;
  onFormChange: (updater: (current: Props["form"]) => Props["form"]) => void;
  onSave: () => void;
  onEdit: (budgetId: string) => void;
  onDelete: (budgetId: string) => void;
  onCancelEdit: () => void;
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
  onEdit,
  onDelete,
  onCancelEdit,
}: Props) {
  const monthTransactions = transactions.filter((transaction) =>
    transaction.occurredOn.startsWith(month),
  );
  const envelopes = getBudgetEnvelopes(budgets, categories, monthTransactions);
  const fundingCapacity = getBudgetFundingCapacity(budgets, monthTransactions);
  const incomeFundingSummaries = getIncomeFundingSummaries(budgets, monthTransactions);
  const expenseCategoryOptions = categoryOptions(
    categories.filter((category) => category.kind === "expense"),
  );
  const incomeTransactionOptions = [
    { value: "__none__", label: "Any income in this month" },
    ...incomeFundingSummaries.map((summary) => ({
        value: summary.transactionId,
        label: `${summary.date} · ${formatMoney(summary.amount, "UGX")}${
          summary.payee ? ` · ${summary.payee}` : ""
        }`,
      })),
  ];
  const selectedFundingSource = incomeFundingSummaries.find(
    (summary) => summary.transactionId === form.incomeTransactionId,
  );

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="mint"
        title={`Budget envelopes · ${month}`}
        description="Allocate monthly spending, link it to income when needed, and manage overspend early."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <StatTile label="Income available" value={formatMoney(fundingCapacity.inflow, "UGX")} />
          <StatTile label="Allocated" value={formatMoney(fundingCapacity.allocated, "UGX")} />
          <StatTile
            label="Unallocated income"
            value={
              <AmountIndicator
                tone={
                  fundingCapacity.unallocatedIncome > 0
                    ? "positive"
                    : fundingCapacity.unallocatedIncome < 0
                      ? "negative"
                      : "neutral"
                }
                sign={
                  fundingCapacity.unallocatedIncome > 0
                    ? "positive"
                    : fundingCapacity.unallocatedIncome < 0
                      ? "negative"
                      : "none"
                }
                value={formatMoney(Math.abs(fundingCapacity.unallocatedIncome), "UGX")}
                className="text-lg"
              />
            }
          />
        </div>

        {incomeFundingSummaries.length > 0 ? (
          <div className="grid gap-2">
            <div className="text-sm text-foreground">Income funding</div>
            <div className="grid gap-2 md:grid-cols-2">
              {incomeFundingSummaries.map((summary) => (
                <div key={summary.transactionId} className="border border-border/20 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-foreground">
                        {summary.payee ?? "Income event"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {summary.date} · {summary.linkedBudgetCount} linked budget
                        {summary.linkedBudgetCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        onFormChange((current) => ({
                          ...current,
                          incomeTransactionId: summary.transactionId,
                        }))
                      }
                    >
                      Use
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <div>Total {formatMoney(summary.amount, "UGX")}</div>
                    <div>Allocated {formatMoney(summary.allocated, "UGX")}</div>
                    <div>Remaining {formatMoney(summary.remaining, "UGX")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr]">
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
            <SelectField
              label="Source income"
              value={form.incomeTransactionId || "__none__"}
              options={incomeTransactionOptions}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  incomeTransactionId: value === "__none__" ? "" : value,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <div className="flex gap-2">
              <InputField
                id="budget-target-amount"
                label="Allocated (UGX)"
                inputMode="numeric"
                value={form.targetAmount}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    targetAmount: event.target.value,
                  }))
                }
              />
              {selectedFundingSource ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() =>
                    onFormChange((current) => ({
                      ...current,
                      targetAmount: String(Math.max(0, selectedFundingSource.remaining)),
                    }))
                  }
                >
                  Use remaining
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <InputField
              id="budget-rollover-amount"
              label="Rollover (UGX)"
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
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={isSubmitting} onClick={onSave}>
            {form.budgetId ? "Update budget" : "Save budget"}
          </Button>
          {form.budgetId ? (
            <Button type="button" size="sm" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-2">
          {envelopes.length === 0 ? (
            <EmptyState className="py-6">No budgets set for this month.</EmptyState>
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
                      Allocated {formatMoney(envelope.allocated, "UGX")} · Spent{" "}
                      {formatMoney(envelope.spent, "UGX")}
                      {envelope.incomeTransactionId ? " · income-linked" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      value={formatMoney(Math.abs(envelope.remaining), "UGX")}
                      className="text-sm font-medium"
                    />
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onEdit(envelope.budgetId)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={isSubmitting}
                      onClick={() => onDelete(envelope.budgetId)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
