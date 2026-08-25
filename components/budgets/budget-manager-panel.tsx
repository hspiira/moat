"use client";

import { useMemo, useState } from "react";
import { IconAlertTriangle, IconChevronRight, IconPlus } from "@tabler/icons-react";

import { formatMoney } from "@/lib/currency";
import { validateAmount } from "@/lib/validation";
import type { BudgetTarget, Category, Transaction } from "@/lib/types";
import {
  getBudgetEnvelopes,
  getBudgetFundingCapacity,
  getIncomeFundingSummaries,
  type BudgetEnvelope,
} from "@/lib/domain/budgets";
import {
  getBudgetMonthPosition,
  getEnvelopeProgress,
  type EnvelopeStatus,
} from "@/lib/domain/budget-progress";

import { AmountField } from "@/components/forms/amount-field";
import { SelectField } from "@/components/forms/select-field";
import { categoryOptions } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { Money } from "@/components/ui/money";
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
import { parseAmountInput } from "@/lib/parse-amount";

type Props = {
  month: string;
  categories: Category[];
  budgets: BudgetTarget[];
  /** Off when the page states the month's position above this panel. */
  showSummary?: boolean;
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

const meterTone: Record<EnvelopeStatus, "positive" | "warning" | "negative"> = {
  on_track: "positive",
  near_limit: "warning",
  overspent: "negative",
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
  showSummary = true,
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

  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.occurredOn.startsWith(month)),
    [month, transactions],
  );
  const envelopes = useMemo(
    () => getBudgetEnvelopes(budgets, categories, monthTransactions),
    [budgets, categories, monthTransactions],
  );
  const position = useMemo(
    () => getBudgetMonthPosition(envelopes, getBudgetFundingCapacity(budgets, monthTransactions)),
    [budgets, envelopes, monthTransactions],
  );
  const incomeFundingSummaries = useMemo(
    () => getIncomeFundingSummaries(budgets, monthTransactions),
    [budgets, monthTransactions],
  );
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
    <div id="budgets" className="grid min-w-0 scroll-mt-20 gap-4">
      {showSummary ? (
      <div className="grid gap-1 pt-2">
        {position.allocated === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Waiting to be given a job</p>
            <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
              <Money
                amount={Math.max(position.unallocatedIncome, 0)}
                currency="UGX"
                tone="neutral"
                className="font-display"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Nothing is budgeted this month yet, so there is no limit to spend against.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {position.remaining < 0 ? "Over budget by" : "Left to spend"}
            </p>
            <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
              <Money
                amount={Math.abs(position.remaining)}
                currency="UGX"
                tone={position.remaining < 0 ? "negative" : "positive"}
                className="font-display"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatMoney(position.spent, "UGX")} spent of{" "}
              {formatMoney(position.allocated, "UGX")} allocated
              {position.unallocatedIncome > 0
                ? ` · ${formatMoney(position.unallocatedIncome, "UGX")} income not yet allocated`
                : position.unallocatedIncome < 0
                  ? ` · allocated ${formatMoney(Math.abs(position.unallocatedIncome), "UGX")} beyond income`
                  : ""}
            </p>
          </>
        )}
        {position.overspentCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-neg">
            <IconAlertTriangle aria-hidden className="size-4 shrink-0" />
            {position.overspentCount}{" "}
            {position.overspentCount === 1 ? "envelope is" : "envelopes are"} overspent
          </p>
        ) : null}
      </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={openForCreate} className="flex-1 sm:flex-none sm:px-6">
          <IconPlus className="size-4" /> Add budget
        </Button>
      </div>

      <div className="min-w-0">
        {envelopes.length === 0 ? (
          <EmptyState className="py-10">
            No budgets for this month yet. Add one to start tracking a category.
          </EmptyState>
        ) : (
          <div className="min-w-0">
            {envelopes.map((envelope) => (
              <EnvelopeRow
                key={envelope.categoryId}
                envelope={envelope}
                onOpen={() => openForEdit(envelope.budgetId)}
              />
            ))}
          </div>
        )}
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
              <div className="grid gap-2">
                <Button
                  type="submit"
                  size="lg"
                  form="budget-form"
                  disabled={isSubmitting || !form.categoryId}
                  className="w-full"
                >
                  {form.budgetId ? "Update budget" : "Save budget"}
                </Button>
                {form.budgetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={isSubmitting}
                    onClick={() => {
                      const target = envelopes.find(
                        (envelope) => envelope.budgetId === form.budgetId,
                      );
                      setIsOpen(false);
                      del.request(
                        { budgetId: form.budgetId as string },
                        target?.categoryName ?? "this budget",
                      );
                    }}
                  >
                    Delete budget
                  </Button>
                ) : null}
              </div>
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
              <SelectField
                label="Category"
                value={form.categoryId}
                placeholder="Select category"
                options={expenseCategoryOptions}
                onValueChange={(value) =>
                  onFormChange((current) => ({ ...current, categoryId: value }))
                }
              />
              <SelectField
                label="Funded by"
                value={form.incomeTransactionId || "__none__"}
                options={incomeTransactionOptions}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    incomeTransactionId: value === "__none__" ? "" : value,
                  }))
                }
              />
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <AmountField
                    id="budget-target-amount"
                    label="Allocated (UGX)"
                    value={parseAmountInput(form.targetAmount)}
                    error={targetError}
                    onValueChange={(value) =>
                      onFormChange((current) => ({
                        ...current,
                        targetAmount: value === null ? "" : String(value),
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
              {selectedFundingSource ? (
                <p className="text-xs text-muted-foreground">
                  {formatMoney(selectedFundingSource.remaining, "UGX")} of{" "}
                  {formatMoney(selectedFundingSource.amount, "UGX")} still unallocated on that
                  income.
                </p>
              ) : null}
              <AmountField
                id="budget-rollover-amount"
                label="Rollover (UGX)"
                hint="Carried over from last month, added on top of the allocation."
                value={parseAmountInput(form.rolloverAmount)}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    rolloverAmount: value === null ? "" : String(value),
                  }))
                }
              />
            </form>
          </FormCardShell>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        {...del.dialogProps}
        title="Delete this budget?"
        description={
          <>
            The budget for <span className="font-medium text-foreground">{del.label}</span> will be
            removed. Your transactions stay put.
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

function EnvelopeRow({
  envelope,
  onOpen,
}: {
  envelope: BudgetEnvelope;
  onOpen: () => void;
}) {
  const progress = getEnvelopeProgress(envelope);
  const spentLabel = `${formatMoney(envelope.spent, "UGX")} of ${formatMoney(
    envelope.allocated,
    "UGX",
  )} spent`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full min-w-0 gap-2 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {envelope.categoryName}
        </span>
        <span className="shrink-0 text-sm">
          {progress.status === "overspent" ? (
            <span className="text-neg">
              over by <Money amount={progress.overspentBy} currency="UGX" tone="negative" />
            </span>
          ) : (
            <>
              <Money
                amount={envelope.remaining}
                currency="UGX"
                tone={progress.status === "near_limit" ? "warning" : "positive"}
                className="font-semibold"
              />
              <span className="text-muted-foreground"> left</span>
            </>
          )}
        </span>
        <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <Meter fraction={progress.fraction} tone={meterTone[progress.status]} valueLabel={spentLabel} />

      <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{spentLabel}</span>
        {envelope.rollover > 0 ? (
          <span className="shrink-0">incl. {formatMoney(envelope.rollover, "UGX")} rollover</span>
        ) : envelope.incomeTransactionId ? (
          <span className="shrink-0">income-linked</span>
        ) : null}
      </div>
    </button>
  );
}
