"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/currency";
import { validateAmount } from "@/lib/validation";
import type { BudgetTarget, Category, Transaction } from "@/lib/types";
import {
  getBudgetEnvelopes,
  getBudgetFundingCapacity,
  getIncomeFundingSummaries,
} from "@/lib/domain/budgets";
import { IconPlus } from "@tabler/icons-react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { AmountIndicator } from "@/components/amount-indicator";
import { SelectField } from "@/components/forms/select-field";
import { categoryOptions } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormCardShell } from "@/components/forms/form-card-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfirmDelete } from "@/components/hooks/use-confirm-delete";
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
  const del = useConfirmDelete<{ budgetId: string }>((envelope) => onDelete(envelope.budgetId));
  const [targetError, setTargetError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      onCancelEdit();
      setTargetError(null);
    }
  }
  function openForCreate() {
    onCancelEdit();
    setTargetError(null);
    setIsOpen(true);
  }
  function openForEdit(budgetId: string) {
    onEdit(budgetId);
    setTargetError(null);
    setIsOpen(true);
  }
  function handleSave() {
    const error = validateAmount(form.targetAmount, {
      requiredMessage: "Enter an amount to allocate.",
    });
    if (error) {
      setTargetError(error);
      return;
    }
    setTargetError(null);
    onSave();
    setIsOpen(false);
  }
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
                      onClick={() => {
                        onFormChange((current) => ({
                          ...current,
                          incomeTransactionId: summary.transactionId,
                        }));
                        setIsOpen(true);
                      }}
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

        <div>
          <Button type="button" size="sm" onClick={openForCreate}>
            <IconPlus className="size-4" /> Add budget
          </Button>
        </div>

        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>{form.budgetId ? "Edit budget" : "Add budget"}</SheetTitle>
              <SheetDescription>Allocate monthly spending for a category.</SheetDescription>
            </SheetHeader>
            <FormCardShell
              embedded
              title={form.budgetId ? "Edit budget" : "Add budget"}
              description="Allocate what you plan to spend on a category this month."
              footer={
                <Button
                  type="submit"
                  form="budget-form"
                  disabled={isSubmitting || !form.categoryId}
                  className="w-full"
                >
                  {form.budgetId ? "Update budget" : "Save budget"}
                </Button>
              }
            >
              <form
                id="budget-form"
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
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
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <InputField
                  id="budget-target-amount"
                  label="Allocated (UGX)"
                  inputMode="numeric"
                  value={form.targetAmount}
                  error={targetError}
                  onChange={(event) =>
                    onFormChange((current) => ({
                      ...current,
                      targetAmount: event.target.value,
                    }))
                  }
                />
              </div>
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
              </form>
            </FormCardShell>
          </SheetContent>
        </Sheet>

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
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openForEdit(envelope.budgetId)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={isSubmitting}
                      onClick={() => del.request(envelope, envelope.categoryName)}
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
      <ConfirmDialog
        {...del.dialogProps}
        title="Delete this budget?"
        description={
          <>
            The budget for{" "}
            <span className="font-medium text-foreground">{del.label}</span> will be removed. Your
            transactions stay put.
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </Card>
  );
}
