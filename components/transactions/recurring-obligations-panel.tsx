"use client";

import { useState } from "react";

import { isSuggestedRecurringObligation } from "@/lib/domain/recurring";
import type { Account, Category, RecurringObligation } from "@/lib/types";
import type { RecurringEvaluation, SuggestedRecurringObligation } from "@/lib/domain/recurring";
import { IconPlus } from "@tabler/icons-react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  accountOptions,
  categoryOptions,
  optionsFromRecord,
  recurringCadenceLabels,
  recurringObligationTypeLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/currency";
import { validateAmount, validateInteger } from "@/lib/validation";

type ObligationFormState = {
  name: string;
  type: RecurringObligation["type"];
  categoryId: string;
  expectedAmount: string;
  cadence: RecurringObligation["cadence"];
  dueDay: string;
  linkedAccountId: string;
  payee: string;
};

/**
 * Narrows an evaluation's obligation to the persisted shape so it can be
 * passed to `onToggleObligation`. Suggested obligations (identified by their
 * `suggested:` id prefix) are never persistable and are rendered read-only
 * instead — see the `evaluations.map` below.
 */
function isPersistedObligation(
  obligation: RecurringObligation | SuggestedRecurringObligation,
): obligation is RecurringObligation {
  return !isSuggestedRecurringObligation(obligation.id);
}

const defaultObligationForm: ObligationFormState = {
  name: "",
  type: "rent",
  categoryId: "",
  expectedAmount: "",
  cadence: "monthly",
  dueDay: "1",
  linkedAccountId: "",
  payee: "",
};

type Props = {
  accounts: Account[];
  categories: Category[];
  evaluations: RecurringEvaluation[];
  isSubmitting: boolean;
  onSaveObligation: (
    obligation: Omit<RecurringObligation, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onToggleObligation: (obligation: RecurringObligation) => void;
};

export function RecurringObligationsPanel({
  accounts,
  categories,
  evaluations,
  isSubmitting,
  onSaveObligation,
  onToggleObligation,
}: Props) {
  const [form, setForm] = useState<ObligationFormState>(defaultObligationForm);
  const [fieldErrors, setFieldErrors] = useState<{ expectedAmount?: string; dueDay?: string }>({});
  const [isOpen, setIsOpen] = useState(false);
  const linkedAccountOptions = [{ value: "__none__", label: "Any account" }, ...accountOptions(accounts)];

  function openForCreate() {
    setForm(defaultObligationForm);
    setFieldErrors({});
    setIsOpen(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.categoryId) return;
    const nextErrors: { expectedAmount?: string; dueDay?: string } = {};
    const amountError = validateAmount(form.expectedAmount, {
      requiredMessage: "Enter the expected amount.",
    });
    if (amountError) nextErrors.expectedAmount = amountError;
    const dueDayError = validateInteger(form.dueDay, 1, 31, "Enter a due day.");
    if (dueDayError) nextErrors.dueDay = dueDayError;
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    onSaveObligation({
      name: form.name.trim(),
      type: form.type,
      categoryId: form.categoryId,
      expectedAmount: Number(form.expectedAmount),
      cadence: form.cadence,
      dueDay: Number(form.dueDay),
      dueDatePattern: undefined,
      linkedAccountId: form.linkedAccountId || undefined,
      payee: form.payee.trim() || undefined,
      status: "active",
    });
    setForm(defaultObligationForm);
    setIsOpen(false);
  }

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title="Recurring bills"
        description="Track expected salary, rent, school fees, loan repayments, and SACCO contributions."
      />
      <CardContent className="grid gap-4 p-5">
        <div>
          <Button type="button" size="sm" onClick={openForCreate}>
            <IconPlus className="size-4" /> Add bill
          </Button>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Add recurring bill</SheetTitle>
              <SheetDescription>Track an expected recurring payment.</SheetDescription>
            </SheetHeader>
            <FormCardShell
              embedded
              title="Add recurring bill"
              description="Track expected salary, rent, school fees, or loan repayments."
              footer={
                <Button
                  type="submit"
                  form="obligation-form"
                  disabled={isSubmitting || !form.name.trim() || !form.categoryId}
                  className="w-full"
                >
                  Save bill
                </Button>
              }
            >
              <form
                id="obligation-form"
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
          <InputField
            id="obligation-name"
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="April rent"
          />
          <div className="grid gap-2">
            <SelectField
              label="Type"
              value={form.type}
              options={optionsFromRecord(recurringObligationTypeLabels)}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  type: value as RecurringObligation["type"],
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <SelectField
              label="Category"
              value={form.categoryId}
              placeholder="Select category"
              options={categoryOptions(categories)}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, categoryId: value }))
              }
            />
          </div>
          <InputField
            id="obligation-amount"
            label="Expected amount (UGX)"
            inputMode="numeric"
            value={form.expectedAmount}
            error={fieldErrors.expectedAmount}
            onChange={(event) =>
              setForm((current) => ({ ...current, expectedAmount: event.target.value }))
            }
          />
          <div className="grid gap-2">
            <SelectField
              label="Cadence"
              value={form.cadence}
              options={optionsFromRecord(recurringCadenceLabels)}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  cadence: value as RecurringObligation["cadence"],
                }))
              }
            />
          </div>
          <InputField
            id="obligation-due-day"
            label="Due day (1–31)"
            inputMode="numeric"
            value={form.dueDay}
            error={fieldErrors.dueDay}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDay: event.target.value }))
            }
          />
          <div className="grid gap-2">
            <SelectField
              label="Linked account"
              value={form.linkedAccountId || "__none__"}
              placeholder="Any account"
              options={linkedAccountOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  linkedAccountId: value === "__none__" ? "" : value,
                }))
              }
            />
          </div>
          <InputField
            id="obligation-payee"
            label="Payee"
            value={form.payee}
            onChange={(event) =>
              setForm((current) => ({ ...current, payee: event.target.value }))
            }
            placeholder="Landlord"
          />
              </form>
            </FormCardShell>
          </SheetContent>
        </Sheet>

        <div className="grid gap-2">
          {evaluations.length === 0 ? (
            <EmptyState className="py-6">No recurring bills yet.</EmptyState>
          ) : (
            evaluations.map((evaluation) => {
              const { obligation } = evaluation;

              return (
                <div
                  key={obligation.id}
                  className="flex items-center justify-between gap-3 border border-border/20 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm text-foreground">{obligation.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(evaluation.expectedAmount)} expected ·{" "}
                      {formatMoney(evaluation.matchedAmount)} matched · {evaluation.state}
                    </div>
                  </div>
                  {isPersistedObligation(obligation) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onToggleObligation(obligation)}
                    >
                      {obligation.status === "active" ? "Pause" : "Resume"}
                    </Button>
                  ) : (
                    <div className="text-xs text-muted-foreground">Suggested</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
