"use client";

import { useMemo, useState } from "react";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";

import { isSuggestedRecurringObligation } from "@/lib/domain/recurring";
import {
  describeInterval,
  normaliseInterval,
  recurringIntervalUnits,
  resolveInterval,
} from "@/lib/domain/recurring-interval";
import { collectPickOptions } from "@/lib/domain/pick-options";
import type { Account, Category, RecurringInterval, RecurringObligation } from "@/lib/types";
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
  recurringObligationTypeLabels,
} from "@/lib/select-options";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PickOrCreateField } from "@/components/ui/pick-or-create-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import { formatMonthLabel } from "@/lib/format-date";
import { parseAmountInput } from "@/lib/parse-amount";
import { validateAmount, validateInteger } from "@/lib/validation";

type ObligationFormState = {
  name: string;
  type: RecurringObligation["type"];
  categoryId: string;
  expectedAmount: string;
  intervalEvery: string;
  intervalUnit: RecurringInterval["unit"];
  dueDay: string;
  linkedAccountId: string;
  payee: string;
  startsOn: string;
  endsOn: string;
};

function isPersistedObligation(
  obligation: RecurringObligation | SuggestedRecurringObligation,
): obligation is RecurringObligation {
  return !isSuggestedRecurringObligation(obligation.id);
}

function describeBillWindow(obligation: RecurringObligation) {
  if (obligation.startsOn && obligation.endsOn) {
    return `runs ${formatMonthLabel(obligation.startsOn)} to ${formatMonthLabel(obligation.endsOn)}`;
  }
  if (obligation.startsOn) return `starts ${formatMonthLabel(obligation.startsOn)}`;
  if (obligation.endsOn) return `ended ${formatMonthLabel(obligation.endsOn)}`;
  return "outside this month";
}

const defaultObligationForm: ObligationFormState = {
  name: "",
  type: "rent",
  categoryId: "",
  expectedAmount: "",
  intervalEvery: "1",
  intervalUnit: "month",
  dueDay: "1",
  linkedAccountId: "",
  payee: "",
  startsOn: "",
  endsOn: "",
};

type Props = {
  accounts: Account[];
  categories: Category[];
  evaluations: RecurringEvaluation[];
  obligations: RecurringObligation[];
  today: string;
  isSubmitting: boolean;
  /** Off when the page states the month's position above this panel. */
  showSummary?: boolean;
  onSaveObligation: (
    obligation: Omit<RecurringObligation, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onToggleObligation: (obligation: RecurringObligation) => void;
};

export function RecurringObligationsPanel({
  accounts,
  categories,
  evaluations,
  obligations,
  today,
  isSubmitting,
  showSummary = true,
  onSaveObligation,
  onToggleObligation,
}: Props) {
  const [form, setForm] = useState<ObligationFormState>(defaultObligationForm);
  const interval = normaliseInterval({
    every: Number(form.intervalEvery),
    unit: form.intervalUnit,
  });
  // The payees already written down, so the same landlord is not typed three
  // ways and counted as three.
  const payeeOptions = useMemo(
    () => collectPickOptions(obligations.map((obligation) => obligation.payee)),
    [obligations],
  );
  const [fieldErrors, setFieldErrors] = useState<{
    expectedAmount?: string;
    dueDay?: string;
    endsOn?: string;
  }>({});
  const [isOpen, setIsOpen] = useState(false);
  const linkedAccountOptions = [
    { value: "__none__", label: "Any account" },
    ...accountOptions(accounts),
  ];

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
    const nextErrors: { expectedAmount?: string; dueDay?: string; endsOn?: string } = {};
    const amountError = validateAmount(form.expectedAmount, {
      requiredMessage: "Enter the expected amount.",
    });
    if (amountError) nextErrors.expectedAmount = amountError;
    const dueDayError = validateInteger(form.dueDay, 1, 31, "Enter a due day.");
    if (dueDayError) nextErrors.dueDay = dueDayError;
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
      nextErrors.endsOn = "The last month cannot be before the first.";
    }
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
      // Cadence is still written so anything reading it keeps working, but the
      // interval is what says when this is actually owed.
      cadence: interval.unit === "week" && interval.every === 1 ? "weekly" : "monthly",
      interval,
      dueDay: Number(form.dueDay),
      dueDatePattern: undefined,
      linkedAccountId: form.linkedAccountId || undefined,
      payee: form.payee.trim() || undefined,
      startsOn: form.startsOn || undefined,
      endsOn: form.endsOn || undefined,
      status: "active",
    });
    setForm(defaultObligationForm);
    setIsOpen(false);
  }

  const isEmpty =
    sections.outstanding.length === 0 &&
    sections.paid.length === 0 &&
    sections.paused.length === 0 &&
    sections.offSchedule.length === 0;

  return (
    <div id="recurring" className="grid min-w-0 scroll-mt-20 gap-4">
      {showSummary ? (
      <div className="grid gap-1 pt-2">
        <p className="text-sm text-muted-foreground">Still to pay this month</p>
        <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
          <Money
            amount={sections.outstandingTotal}
            currency="UGX"
            tone={sections.outstandingTotal > 0 ? "warning" : "positive"}
            className="font-display"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {sections.outstanding.length} outstanding · {sections.paid.length} paid
          {sections.paused.length > 0 ? ` · ${sections.paused.length} paused` : ""}
        </p>
      </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={() => openForCreate()} className="flex-1 sm:flex-none sm:px-6">
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

          {sections.offSchedule.length > 0 ? (
            <BillSection title="Not due this month">
              {sections.offSchedule.map((obligation) => (
                <div key={obligation.id} className="min-w-0 py-3">
                  <div className="truncate text-sm text-muted-foreground">{obligation.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatMoney(obligation.expectedAmount, "UGX")} ·{" "}
                    {describeInterval(resolveInterval(obligation))} ·{" "}
                    {describeBillWindow(obligation)}
                  </div>
                </div>
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
                size="lg"
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
                <div className="grid gap-2">
                  <Label htmlFor="obligation-interval-every">Repeats</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">every</span>
                    <Input
                      id="obligation-interval-every"
                      inputMode="numeric"
                      className="w-16"
                      value={form.intervalEvery}
                      aria-label="How many"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, intervalEvery: event.target.value }))
                      }
                    />
                    <Select
                      value={form.intervalUnit}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          intervalUnit: value as RecurringInterval["unit"],
                        }))
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Weeks, months or years">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recurringIntervalUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {Number(form.intervalEvery) === 1 ? `${unit}` : `${unit}s`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">{describeInterval(interval)}</p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  id="obligation-starts-on"
                  label="First month (optional)"
                  type="month"
                  value={form.startsOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsOn: event.target.value }))
                  }
                />
                <InputField
                  id="obligation-ends-on"
                  label="Last month (optional)"
                  type="month"
                  value={form.endsOn}
                  error={fieldErrors.endsOn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endsOn: event.target.value }))
                  }
                />
              </div>
              <PickOrCreateField
                id="obligation-payee"
                label="Payee"
                placeholder="Landlord"
                searchPlaceholder="Search or type a payee"
                emptyHint="No payees yet. Type one to add it."
                options={payeeOptions}
                value={form.payee}
                allowClear
                onChange={(payee) => setForm((current) => ({ ...current, payee }))}
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
      <div className="min-w-0">{children}</div>
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
                  startsOn: obligation.startsOn?.slice(0, 7) ?? "",
                  endsOn: obligation.endsOn?.slice(0, 7) ?? "",
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
