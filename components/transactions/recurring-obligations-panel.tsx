"use client";

import { useState } from "react";

import { isSuggestedRecurringObligation } from "@/lib/domain/recurring";
import type { Account, Category, RecurringObligation } from "@/lib/types";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { AccentCardHeader } from "@/components/accent-card-header";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  const linkedAccountOptions = [{ value: "__none__", label: "Any account" }, ...accountOptions(accounts)];

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title="Recurring obligations"
        description="Track expected salary, rent, school fees, loan repayments, and SACCO contributions."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
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
            label="Expected amount"
            inputMode="numeric"
            value={form.expectedAmount}
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
            label="Due day"
            inputMode="numeric"
            value={form.dueDay}
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
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !form.name.trim() || !form.categoryId}
            onClick={() => {
              onSaveObligation({
                name: form.name.trim(),
                type: form.type,
                categoryId: form.categoryId,
                expectedAmount: Number(form.expectedAmount) || 0,
                cadence: form.cadence,
                dueDay: Number(form.dueDay) || undefined,
                dueDatePattern: undefined,
                linkedAccountId: form.linkedAccountId || undefined,
                payee: form.payee.trim() || undefined,
                status: "active",
              });
              setForm(defaultObligationForm);
            }}
          >
            Save obligation
          </Button>
        </div>

        <div className="grid gap-2">
          {evaluations.length === 0 ? (
            <EmptyState className="py-6">No recurring obligations yet.</EmptyState>
          ) : (
            evaluations.map((evaluation) => (
              <div
                key={evaluation.obligation.id}
                className="flex items-center justify-between gap-3 border border-border/20 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <div className="text-sm text-foreground">{evaluation.obligation.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(evaluation.expectedAmount)} expected ·{" "}
                    {formatCurrency(evaluation.matchedAmount)} matched · {evaluation.state}
                  </div>
                </div>
                {isSuggestedRecurringObligation(evaluation.obligation.id) ? (
                  <div className="text-xs text-muted-foreground">Suggested</div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleObligation(evaluation.obligation)}
                  >
                    {evaluation.obligation.status === "active" ? "Pause" : "Resume"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
