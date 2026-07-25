"use client";

import { useState } from "react";

import type { Account, Category, TransactionRule, TransactionSource, TransactionType } from "@/lib/types";
import { AccentCardHeader } from "@/components/accent-card-header";
import { SelectField } from "@/components/forms/select-field";
import {
  accountOptions,
  categoryOptions,
  optionsFromRecord,
  transactionSourceLabels,
  transactionTypeLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField } from "@/components/forms/input-field";
import { FormCardShell } from "@/components/forms/form-card-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { validateInteger } from "@/lib/validation";

type RuleFormState = {
  name: string;
  priority: string;
  source: TransactionSource | "any";
  payeePattern: string;
  keywordPattern: string;
  amountPattern: string;
  effectPayee: string;
  effectCategoryId: string;
  effectAccountId: string;
  effectTransactionType: TransactionType | "keep";
  autoMarkReviewed: "yes" | "no";
};

const defaultRuleForm: RuleFormState = {
  name: "",
  priority: "100",
  source: "any",
  payeePattern: "",
  keywordPattern: "",
  amountPattern: "",
  effectPayee: "",
  effectCategoryId: "",
  effectAccountId: "",
  effectTransactionType: "keep",
  autoMarkReviewed: "no",
};

type Props = {
  accounts: Account[];
  categories: Category[];
  rules: TransactionRule[];
  isSubmitting: boolean;
  onSaveRule: (rule: Omit<TransactionRule, "id" | "userId" | "createdAt" | "updatedAt">) => void;
  onToggleRule: (rule: TransactionRule) => void;
};

export function TransactionRulesPanel({
  accounts,
  categories,
  rules,
  isSubmitting,
  onSaveRule,
  onToggleRule,
}: Props) {
  const [form, setForm] = useState<RuleFormState>(defaultRuleForm);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openForCreate() {
    setForm(defaultRuleForm);
    setPriorityError(null);
    setIsOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const error = validateInteger(form.priority || "100", 1, 999, "Enter a priority.");
    if (error) {
      setPriorityError(error);
      return;
    }
    setPriorityError(null);
    onSaveRule({
      name: form.name.trim(),
      enabled: true,
      priority: Number(form.priority),
      source: form.source === "any" ? undefined : form.source,
      payeePattern: form.payeePattern.trim() || undefined,
      keywordPattern: form.keywordPattern.trim() || undefined,
      amountPattern: form.amountPattern.trim() || undefined,
      effectPayee: form.effectPayee.trim() || undefined,
      effectCategoryId: form.effectCategoryId || undefined,
      effectAccountId: form.effectAccountId || undefined,
      effectTransactionType:
        form.effectTransactionType === "keep" ? undefined : form.effectTransactionType,
      autoMarkReviewed: form.autoMarkReviewed === "yes",
    });
    setForm(defaultRuleForm);
    setIsOpen(false);
  }

  const sourceOptions = [
    { value: "any", label: "Any source" },
    ...optionsFromRecord(transactionSourceLabels),
  ];
  const reviewOptions = [
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ];
  const categorySelectOptions = [{ value: "__none__", label: "Keep current" }, ...categoryOptions(categories)];
  const accountSelectOptions = [{ value: "__none__", label: "Keep current" }, ...accountOptions(accounts)];
  const effectTypeOptions = [
    { value: "keep", label: "Keep current" },
    ...optionsFromRecord(transactionTypeLabels).filter((option) => option.value !== "transfer"),
  ];

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="sage"
        title="Transaction rules"
        description="Tidy up payees and prefill fields automatically — rules never post on their own."
      />
      <CardContent className="grid gap-4 p-5">
        <div>
          <Button type="button" size="sm" onClick={openForCreate}>
            <IconPlus className="size-4" /> Add rule
          </Button>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Add transaction rule</SheetTitle>
              <SheetDescription>Tidy up payees and prefill fields automatically.</SheetDescription>
            </SheetHeader>
            <FormCardShell
              embedded
              title="Add rule"
              description="Tidy up payees and prefill fields automatically — rules never post on their own."
              footer={
                <Button
                  type="submit"
                  form="rule-form"
                  disabled={isSubmitting || !form.name.trim()}
                  className="w-full"
                >
                  Save rule
                </Button>
              }
            >
              <form
                id="rule-form"
                className="grid gap-3 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
          <InputField
            id="rule-name"
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Incoming payment alert"
          />
          <InputField
            id="rule-priority"
            label="Priority (1–999, lower runs first)"
            inputMode="numeric"
            value={form.priority}
            error={priorityError}
            onChange={(event) =>
              setForm((current) => ({ ...current, priority: event.target.value }))
            }
          />
          <div className="grid gap-2">
            <SelectField
              label="Source"
              value={form.source}
              options={sourceOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  source: value as RuleFormState["source"],
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <SelectField
              label="Auto mark reviewed"
              value={form.autoMarkReviewed}
              options={reviewOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  autoMarkReviewed: value as RuleFormState["autoMarkReviewed"],
                }))
              }
            />
          </div>
          <InputField
            id="rule-payee-pattern"
            label="Payee pattern"
            value={form.payeePattern}
            onChange={(event) =>
              setForm((current) => ({ ...current, payeePattern: event.target.value }))
            }
            placeholder="employer"
          />
          <InputField
            id="rule-keyword-pattern"
            label="Keyword pattern"
            value={form.keywordPattern}
            onChange={(event) =>
              setForm((current) => ({ ...current, keywordPattern: event.target.value }))
            }
            placeholder="payment"
          />
          <InputField
            id="rule-amount-pattern"
            label="Amount pattern"
            value={form.amountPattern}
            onChange={(event) =>
              setForm((current) => ({ ...current, amountPattern: event.target.value }))
            }
            placeholder="100000"
          />
          <InputField
            id="rule-normalized-payee"
            label="Normalized payee"
            value={form.effectPayee}
            onChange={(event) =>
              setForm((current) => ({ ...current, effectPayee: event.target.value }))
            }
            placeholder="Employer Ltd"
          />
          <div className="grid gap-2">
            <SelectField
              label="Effect category"
              value={form.effectCategoryId || "__none__"}
              placeholder="Keep current"
              options={categorySelectOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  effectCategoryId: value === "__none__" ? "" : value,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <SelectField
              label="Effect account"
              value={form.effectAccountId || "__none__"}
              placeholder="Keep current"
              options={accountSelectOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  effectAccountId: value === "__none__" ? "" : value,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <SelectField
              label="Effect type"
              value={form.effectTransactionType}
              options={effectTypeOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  effectTransactionType: value as RuleFormState["effectTransactionType"],
                }))
              }
            />
          </div>
              </form>
            </FormCardShell>
          </SheetContent>
        </Sheet>

        <div className="grid gap-2">
          {rules.length === 0 ? (
            <EmptyState className="py-6">No rules yet.</EmptyState>
          ) : (
            [...rules]
              .sort((left, right) => left.priority - right.priority)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-3 border border-border/20 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm text-foreground">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Priority {rule.priority}
                      {rule.payeePattern ? ` · Payee contains "${rule.payeePattern}"` : ""}
                      {rule.keywordPattern ? ` · Note contains "${rule.keywordPattern}"` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleRule(rule)}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
