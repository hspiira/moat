"use client";

import { useMemo, useState } from "react";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";

import { isSuggestedRecurringObligation } from "@/lib/domain/recurring";
import type { Account, Category, RecurringObligation } from "@/lib/types";
import type { RecurringEvaluation, SuggestedRecurringObligation } from "@/lib/domain/recurring";
import {
  getRecurringSections,
  type OutstandingBill,
} from "@/lib/domain/recurring-groups";

import { AmountField } from "@/components/forms/amount-field";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import { parseAmountInput } from "@/lib/parse-amount";
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
 * Narrows an evaluation's obligation to the persisted shape. Suggested ones
 * (identified by their `suggested:` id prefix) are not persisted and cannot be
 * paused — they are offered for tracking instead.
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
  obligations: RecurringObligation[];
  today: string;
  isSubmitting: boolean;
  onSaveObligation: (
    obligation: Omit<RecurringObligation, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onToggleObligation: (obligation: RecurringObligation) => void;
};

/**
 * Recurring bills, grouped by what they still need from you.
 *
 * The old list was flat, printed `evaluation.state` verbatim so a row read
 * "… · missing", and never showed the due day even though it was captured. It
 * also rendered evaluations only — and evaluation covers active bills — so
 * pausing a bill removed it from the screen together with the Resume button
 * that was its only way back.
 */
export function RecurringObligationsPanel({
  accounts,
  categories,
  evaluations,
  obligations,
  today,
  isSubmitting,
  onSaveObligation,
  onToggleObligation,
}: Props) {
  const [form, setForm] = useState<ObligationFormState>(defaultObligationForm);
  const [fieldErrors, setFieldErrors] = useState<{ expectedAmount?: string; dueDay?: string }>({});
  const [isOpen, setIsOpen] = useState(false);
  const linkedAccountOptions = [
    { value: "__none__", label: "Any account" },
    ...accountOptions(accounts),
  ];

  // Memoised: `form` state changes on every keystroke, and regrouping every
  // bill on each one is wasted work.
  const sections = useMemo(
    () => getRecurringSections({ evaluations, obligations, today }),
    [evaluations, obligations, today],
  );

  function openForCreate(seed?: Partial<ObligationFormState>) {
    setForm({ ...defaultObligationForm, ...seed });
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
      expectedAmount: parseAmountInput(form.expectedAmount) ?? 0,
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

  const isEmpty =
    sections.outstanding.length === 0 &&
    sections.paid.length === 0 &&
    sections.paused.length === 0;

  return (
    <div id="recurring" className="grid min-w-0 scroll-mt-20 gap-4">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm text-muted-foreground">Still to pay this month</span>
          <Money
            amount={sections.outstandingTotal}
            currency="UGX"
            tone={sections.outstandingTotal > 0 ? "warning" : "positive"}
            className="text-2xl font-semibold"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {sections.outstanding.length} outstanding · {sections.paid.length} paid
          {sections.paused.length > 0 ? ` · ${sections.paused.length} paused` : ""}
        </p>
      </div>

      <div>
        <Button type="button" size="sm" onClick={() => openForCreate()}>
          <IconPlus className="size-4" /> Add bill
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState className="py-10">
          No recurring bills yet. Add rent, school fees, or a loan repayment to track it each month.
        </EmptyState>
      ) : (
        <div className="grid min-w-0 gap-4">
          {sections.outstanding.length > 0 ? (
            <BillSection title="Outstanding">
              {sections.outstanding.map((bill) => (
                <BillRow
                  key={bill.obligation.id}
                  bill={bill}
                  isSubmitting={isSubmitting}
                  onToggle={onToggleObligation}
                  onTrackSuggestion={(seed) => openForCreate(seed)}
                />
              ))}
            </BillSection>
          ) : null}

          {sections.paid.length > 0 ? (
            <BillSection title="Paid">
              {sections.paid.map((bill) => (
                <BillRow
                  key={bill.obligation.id}
                  bill={bill}
                  isSubmitting={isSubmitting}
                  onToggle={onToggleObligation}
                  onTrackSuggestion={(seed) => openForCreate(seed)}
                />
              ))}
            </BillSection>
          ) : null}

          {sections.paused.length > 0 ? (
            <BillSection title="Paused">
              {sections.paused.map((obligation) => (
                <div
                  key={obligation.id}
                  className="flex min-w-0 items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-muted-foreground">{obligation.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatMoney(obligation.expectedAmount, "UGX")} · not being tracked
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={isSubmitting}
                    onClick={() => onToggleObligation(obligation)}
                  >
                    Resume
                  </Button>
                </div>
              ))}
            </BillSection>
          ) : null}
        </div>
      )}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Add recurring bill</SheetTitle>
            <SheetDescription>Track an expected recurring payment.</SheetDescription>
          </SheetHeader>
          <FormCardShell
            embedded
            title="Add recurring bill"
            description="Track expected rent, school fees, or loan repayments."
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
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <InputField
                id="obligation-name"
                label="Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="April rent"
              />
              <div className="grid gap-3 sm:grid-cols-2">
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
                <SelectField
                  label="Category"
                  value={form.categoryId}
                  placeholder="Select category"
                  options={categoryOptions(categories)}
                  onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
                />
                <AmountField
                  id="obligation-amount"
                  label="Expected amount (UGX)"
                  value={parseAmountInput(form.expectedAmount)}
                  error={fieldErrors.expectedAmount}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      expectedAmount: value === null ? "" : String(value),
                    }))
                  }
                />
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
                onChange={(event) => setForm((current) => ({ ...current, payee: event.target.value }))}
                placeholder="Landlord"
              />
            </form>
          </FormCardShell>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BillSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-0">
      <h3 className="pb-1 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <div className="min-w-0 divide-y divide-border/60">{children}</div>
    </section>
  );
}

function BillRow({
  bill,
  isSubmitting,
  onToggle,
  onTrackSuggestion,
}: {
  bill: OutstandingBill;
  isSubmitting: boolean;
  onToggle: (obligation: RecurringObligation) => void;
  onTrackSuggestion: (seed: Partial<ObligationFormState>) => void;
}) {
  const { obligation, evaluation, due, stillOwed } = bill;
  const isPaid = evaluation.state === "paid";
  const isPartial = evaluation.state === "partial";
  const persisted = isPersistedObligation(obligation);
  const fraction =
    evaluation.expectedAmount > 0 ? evaluation.matchedAmount / evaluation.expectedAmount : 0;

  return (
    <div className="grid min-w-0 gap-2 py-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{obligation.name}</span>
        <span className="shrink-0 text-sm">
          {isPaid ? (
            <Money
              amount={evaluation.matchedAmount}
              currency="UGX"
              tone="positive"
              className="font-semibold"
            />
          ) : (
            <>
              <Money amount={stillOwed} currency="UGX" tone="warning" className="font-semibold" />
              <span className="text-muted-foreground"> to go</span>
            </>
          )}
        </span>
      </div>

      {isPartial ? (
        <Meter
          fraction={fraction}
          tone="warning"
          valueLabel={`${formatMoney(evaluation.matchedAmount, "UGX")} of ${formatMoney(
            evaluation.expectedAmount,
            "UGX",
          )} paid`}
        />
      ) : null}

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {/* State in words, never the raw enum, and never colour alone. */}
          {due.isOverdue && !isPaid ? (
            <>
              <IconAlertTriangle aria-hidden className="size-3.5 shrink-0 text-neg" />
              <span className="truncate text-neg">Overdue · {due.label ?? "no due day"}</span>
            </>
          ) : (
            <span className="truncate">
              {due.label ?? "No due day"}
              {isPaid
                ? " · paid"
                : isPartial
                  ? ` · ${formatMoney(evaluation.matchedAmount, "UGX")} paid so far`
                  : " · nothing paid yet"}
            </span>
          )}
        </div>

        {persisted ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 text-xs"
            disabled={isSubmitting}
            onClick={() => onToggle(obligation)}
          >
            Pause
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline">Suggested</Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() =>
                onTrackSuggestion({
                  name: obligation.name,
                  categoryId: obligation.categoryId,
                  expectedAmount: String(obligation.expectedAmount),
                  dueDay: String(obligation.dueDay ?? 1),
                })
              }
            >
              Track
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
