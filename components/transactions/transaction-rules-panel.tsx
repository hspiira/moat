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
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField } from "@/components/forms/input-field";

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
        description="Normalize payees and prefill fields without auto-posting."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
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
            label="Priority"
            inputMode="numeric"
            value={form.priority}
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
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !form.name.trim()}
            onClick={() => {
              onSaveRule({
                name: form.name.trim(),
                enabled: true,
                priority: Number(form.priority) || 100,
                source: form.source === "any" ? undefined : form.source,
                payeePattern: form.payeePattern.trim() || undefined,
                keywordPattern: form.keywordPattern.trim() || undefined,
                amountPattern: form.amountPattern.trim() || undefined,
                effectPayee: form.effectPayee.trim() || undefined,
                effectCategoryId: form.effectCategoryId || undefined,
                effectAccountId: form.effectAccountId || undefined,
                effectTransactionType:
                  form.effectTransactionType === "keep"
                    ? undefined
                    : form.effectTransactionType,
                autoMarkReviewed: form.autoMarkReviewed === "yes",
              });
              setForm(defaultRuleForm);
            }}
          >
            Save rule
          </Button>
        </div>

        <div className="grid gap-2">
          {rules.length === 0 ? (
            <EmptyState className="py-6">No rules yet.</EmptyState>
          ) : (
            rules
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
