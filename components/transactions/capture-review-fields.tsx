"use client";

import { useMemo } from "react";

import { AmountField } from "@/components/forms/amount-field";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { accountOptions, categoryOptions } from "@/lib/select-options";
import type { Account, CaptureReviewItem, Category, Transaction, TransactionType } from "@/lib/types";
import { formatMoney } from "@/lib/currency";
import { pendingReviewGap } from "@/lib/domain/balance-gap";

const typeOptions = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "savings_contribution", label: "Savings" },
  { value: "debt_payment", label: "Debt payment" },
];

/** Types that debit an account, and so can carry a provider charge. */
const feeBearingTypes = new Set<CaptureReviewItem["type"]>([
  "expense",
  "debt_payment",
  "savings_contribution",
]);

/**
 * The correction form for one captured item. Controlled by whoever opened it,
 * so the sheet owns the draft and the actions that save it — this component
 * only collects edits.
 */
export function CaptureReviewFields({
  draft,
  accounts,
  categories,
  transactions,
  onChange,
}: {
  draft: CaptureReviewItem;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  onChange: (update: (current: CaptureReviewItem) => CaptureReviewItem) => void;
}) {
  const balanceGap = useMemo(() => pendingReviewGap(draft, transactions), [draft, transactions]);

  const amountLabel =
    draft.currency === "UGX"
      ? `Amount (${draft.currency})`
      : `Amount (${draft.currency}) · ${formatMoney(draft.normalizedAmount, "UGX")}`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          id={`capture-review-date-${draft.id}`}
          label="Date"
          value={draft.occurredOn}
          onChange={(event) => onChange((current) => ({ ...current, occurredOn: event.target.value }))}
        />
        <SelectField
          id={`capture-review-account-${draft.id}`}
          label="Account"
          value={draft.accountId}
          options={accountOptions(accounts)}
          onValueChange={(value) => onChange((current) => ({ ...current, accountId: value }))}
        />
        <SelectField
          id={`capture-review-type-${draft.id}`}
          label="Type"
          value={draft.type}
          options={typeOptions}
          onValueChange={(value) =>
            onChange((current) => ({ ...current, type: value as Exclude<TransactionType, "transfer"> }))
          }
        />
        <SelectField
          id={`capture-review-category-${draft.id}`}
          label="Category"
          value={draft.categoryId}
          options={categoryOptions(categories)}
          onValueChange={(value) => onChange((current) => ({ ...current, categoryId: value }))}
        />
        <InputField
          id={`capture-review-payee-${draft.id}`}
          label="Payee"
          value={draft.payee}
          onChange={(event) => onChange((current) => ({ ...current, payee: event.target.value }))}
        />
        <AmountField
          id={`capture-review-amount-${draft.id}`}
          label={amountLabel}
          value={draft.originalAmount}
          onValueChange={(value) =>
            onChange((current) => ({ ...current, originalAmount: value ?? 0 }))
          }
        />
        {feeBearingTypes.has(draft.type) ? (
          <AmountField
            id={`capture-review-fee-${draft.id}`}
            label="Fee — charges & tax (UGX)"
            value={draft.feeAmount}
            onValueChange={(value) =>
              onChange((current) => ({ ...current, feeAmount: value ?? undefined }))
            }
          />
        ) : null}
      </div>

      <TextareaField
        id={`capture-review-note-${draft.id}`}
        label="Note"
        value={draft.note}
        onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))}
        className="min-h-20"
      />

      {balanceGap && balanceGap.gap < 0 ? (
        <div className="grid gap-2 rounded-lg bg-neg/12 px-3 py-2 text-xs">
          <span className="text-foreground">
            Bank balance is {formatMoney(Math.abs(balanceGap.gap), "UGX")} lower than recorded —
            likely an unrecorded fee.
          </span>
          <button
            type="button"
            className="w-fit rounded-md px-2 py-1 font-medium hover:bg-muted"
            onClick={() => onChange((current) => ({ ...current, feeAmount: Math.abs(balanceGap.gap) }))}
          >
            Add as fee
          </button>
        </div>
      ) : balanceGap && balanceGap.gap > 0 ? (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Bank balance is {formatMoney(balanceGap.gap, "UGX")} higher than recorded — an uncaptured
          credit?
        </div>
      ) : null}
    </div>
  );
}
