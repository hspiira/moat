"use client";

import { useEffect, useMemo, useState } from "react";

import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { accountOptions, categoryOptions } from "@/lib/select-options";
import type { Account, CaptureReviewItem, Category, TransactionType } from "@/lib/types";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type CaptureReviewQueueProps = {
  accounts: Account[];
  categories: Category[];
  items: CaptureReviewItem[];
  isSubmitting: boolean;
  onApprove: (item: CaptureReviewItem) => Promise<void>;
  onReject: (item: CaptureReviewItem) => Promise<void>;
  onMarkDuplicate: (item: CaptureReviewItem) => Promise<void>;
  onUpdateItem: (item: CaptureReviewItem) => Promise<void>;
};

type ReviewFilter = "new" | "needs_review" | "duplicate" | "resolved";

const reviewFilterLabels: Record<ReviewFilter, string> = {
  new: "New",
  needs_review: "Needs review",
  duplicate: "Duplicates",
  resolved: "Resolved",
};

const typeOptions = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "savings_contribution", label: "Savings" },
  { value: "debt_payment", label: "Debt payment" },
];

function getFilteredItems(items: CaptureReviewItem[], filter: ReviewFilter) {
  if (filter === "resolved") {
    return items.filter((item) => item.status === "approved" || item.status === "rejected");
  }

  return items.filter((item) => item.status === filter);
}

function ReviewItemEditor({
  item,
  accounts,
  categories,
  isSubmitting,
  onApprove,
  onReject,
  onMarkDuplicate,
  onUpdateItem,
}: CaptureReviewQueueProps & { item: CaptureReviewItem }) {
  const [draft, setDraft] = useState(item);

  useEffect(() => {
    setDraft(item);
  }, [item]);

  const amountLabel = useMemo(
    () =>
      draft.currency === "UGX"
        ? `Amount (${draft.currency})`
        : `Amount (${draft.currency}) · ${formatMoney(draft.normalizedAmount, "UGX")}`,
    [draft.currency, draft.normalizedAmount],
  );

  return (
    <div className="grid gap-3 border border-border/20 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">{draft.payee || "Unlabeled capture"}</div>
          <div className="text-xs text-muted-foreground">
            {draft.source} · {draft.parserLabel ?? "generic parser"} · {Math.round(draft.confidenceScore * 100)}%
          </div>
        </div>
        <div className="text-sm text-foreground">{formatMoney(draft.originalAmount, draft.currency)}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InputField
          id={`capture-review-date-${draft.id}`}
          label="Date"
          value={draft.occurredOn}
          onChange={(event) => setDraft((current) => ({ ...current, occurredOn: event.target.value }))}
        />
        <SelectField
          id={`capture-review-account-${draft.id}`}
          label="Account"
          value={draft.accountId}
          options={accountOptions(accounts)}
          onValueChange={(value) => setDraft((current) => ({ ...current, accountId: value }))}
        />
        <SelectField
          id={`capture-review-type-${draft.id}`}
          label="Type"
          value={draft.type}
          options={typeOptions}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, type: value as Exclude<TransactionType, "transfer"> }))
          }
        />
        <SelectField
          id={`capture-review-category-${draft.id}`}
          label="Category"
          value={draft.categoryId}
          options={categoryOptions(categories)}
          onValueChange={(value) => setDraft((current) => ({ ...current, categoryId: value }))}
        />
        <InputField
          id={`capture-review-payee-${draft.id}`}
          label="Payee"
          value={draft.payee}
          onChange={(event) => setDraft((current) => ({ ...current, payee: event.target.value }))}
        />
        <InputField
          id={`capture-review-amount-${draft.id}`}
          label={amountLabel}
          inputMode="decimal"
          value={String(draft.originalAmount)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              originalAmount: Number(event.target.value) || 0,
            }))
          }
        />
      </div>

      <TextareaField
        id={`capture-review-note-${draft.id}`}
        label="Note"
        value={draft.note}
        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
        className="min-h-20"
      />

      {draft.issues.length > 0 ? (
        <div className="grid gap-1 text-xs text-destructive">
          {draft.issues.map((issue) => (
            <div key={`${draft.id}:${issue}`}>{issue}</div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => void onUpdateItem(draft)}>
          Save changes
        </Button>
        <Button type="button" size="sm" disabled={isSubmitting} onClick={() => void onApprove(draft)}>
          Approve to ledger
        </Button>
        {draft.status !== "duplicate" ? (
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => void onMarkDuplicate(draft)}>
            Mark duplicate
          </Button>
        ) : null}
        {draft.status !== "rejected" ? (
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => void onReject(draft)}>
            Reject
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CaptureReviewQueue(props: CaptureReviewQueueProps) {
  const [filter, setFilter] = useState<ReviewFilter>("new");
  const filteredItems = useMemo(() => getFilteredItems(props.items, filter), [filter, props.items]);

  return (
    <Card className="gap-0 border-border/20 pt-0 shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-sm text-foreground">Capture inbox</div>
            <div className="text-sm text-muted-foreground">Review machine-derived candidates before they become transactions.</div>
          </div>
          <div className="flex gap-2">
            {(Object.entries(reviewFilterLabels) as Array<[ReviewFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState className="py-8">No capture items in this queue.</EmptyState>
        ) : (
          <div className="grid gap-3">
            {filteredItems.map((item) => (
              <ReviewItemEditor key={item.id} item={item} {...props} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
