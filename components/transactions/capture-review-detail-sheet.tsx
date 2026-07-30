"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format-date";
import {
  canApproveCaptureItem,
  diffCaptureFromOriginal,
  isCaptureItemEditable,
  resolveDuplicateCounterpart,
} from "@/lib/domain/capture-review";
import { transactionTypeLabels } from "@/lib/select-options";
import type { Account, CaptureReviewItem, Category, Transaction } from "@/lib/types";

import { CaptureReviewFields } from "./capture-review-fields";
import { DetailRow, DetailSection } from "./detail-row";

const inflowTypes = new Set(["income"]);

function labelFor(
  field: string,
  value: string | number | undefined,
  accounts: Account[],
  categories: Category[],
) {
  if (value === undefined || value === "") return "—";
  if (field === "accountId") {
    return accounts.find((entry) => entry.id === value)?.name ?? String(value);
  }
  if (field === "categoryId") {
    return categories.find((entry) => entry.id === value)?.name ?? String(value);
  }
  if (field === "occurredOn") return formatDate(String(value));
  if (field === "type") {
    return transactionTypeLabels[value as keyof typeof transactionTypeLabels] ?? String(value);
  }
  if (field === "originalAmount" || field === "feeAmount") {
    return new Intl.NumberFormat("en-UG").format(Number(value));
  }
  return String(value);
}

/**
 * The review surface for one captured item: read what was parsed, act on it,
 * and drop into the form only when something actually needs correcting.
 *
 * Rendering every open item as a form did not survive contact with real use —
 * parsing a batch of five messages produced five stacked forms to scroll past.
 * Reviewing is the common case and editing is the exception, so editing is now
 * a mode inside this sheet rather than the default presentation of the queue.
 */
export function CaptureReviewDetailSheet({
  item,
  accounts,
  categories,
  items,
  transactions,
  isSubmitting,
  onApprove,
  onReject,
  onMarkDuplicate,
  onClearDuplicate,
  onUpdateItem,
  onOpenChange,
}: {
  item: CaptureReviewItem | null;
  accounts: Account[];
  categories: Category[];
  items: CaptureReviewItem[];
  transactions: Transaction[];
  isSubmitting: boolean;
  onApprove: (item: CaptureReviewItem) => Promise<void>;
  onReject: (item: CaptureReviewItem) => Promise<void>;
  onMarkDuplicate: (item: CaptureReviewItem) => Promise<void>;
  onClearDuplicate: (item: CaptureReviewItem) => Promise<void>;
  onUpdateItem: (item: CaptureReviewItem) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<CaptureReviewItem | null>(item);
  const [isEditing, setIsEditing] = useState(false);

  // Keyed on updatedAt as well as id so a save — which reloads the item with a
  // new timestamp and possibly a new status — resets the sheet to show the saved
  // result. Adjusted during render rather than in an effect, matching the
  // "re-sync when a prop changes" pattern used elsewhere in this codebase.
  const itemKey = item ? `${item.id}:${item.updatedAt}` : null;
  const [seenItemKey, setSeenItemKey] = useState(itemKey);
  if (itemKey !== seenItemKey) {
    setSeenItemKey(itemKey);
    setDraft(item);
    setIsEditing(false);
  }

  const subject = draft ?? item;
  const isOpenItem = item ? isCaptureItemEditable(item) : false;
  const approvable = item ? canApproveCaptureItem(item) : false;

  const account = subject ? accounts.find((entry) => entry.id === subject.accountId) : undefined;
  const category = subject ? categories.find((entry) => entry.id === subject.categoryId) : undefined;
  const changes = subject ? diffCaptureFromOriginal(subject) : [];
  const counterpart = item ? resolveDuplicateCounterpart(item, transactions, items) : null;
  const ledgerTransaction = item?.approvedTransactionId
    ? (transactions.find((entry) => entry.id === item.approvedTransactionId) ?? null)
    : null;
  const isInflow = subject ? inflowTypes.has(subject.type) : false;

  const statusLabel = !item
    ? ""
    : item.status === "approved"
      ? "Approved capture"
      : item.status === "rejected"
        ? "Rejected capture"
        : item.status === "duplicate"
          ? "Possible duplicate"
          : item.status === "needs_review"
            ? "Needs a second look"
            : "Captured, not yet in the ledger";

  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="gap-1 px-4 pt-5 pb-3">
          <SheetTitle className="pr-8 text-base">
            {subject?.payee || category?.name || "Unlabeled capture"}
          </SheetTitle>
          <SheetDescription>{statusLabel}</SheetDescription>
        </SheetHeader>

        {item && subject ? (
          <>
            <div className="grid gap-4 px-4 pb-4">
              {/* Hidden while editing: the amount and the date · account ·
                  category line restate four fields sitting directly below them,
                  so in edit mode this block was 76px of duplication ahead of
                  the first input. */}
              {isEditing ? null : (
                <div className="grid gap-1">
                  <Money
                    amount={subject.normalizedAmount}
                    currency="UGX"
                    tone={isInflow ? "positive" : "negative"}
                    signed
                    className="text-2xl font-semibold"
                  />
                  <div className="text-sm text-muted-foreground">
                    {formatDate(subject.occurredOn, { alwaysYear: true })} ·{" "}
                    {account?.name ?? "Unknown account"}
                    {category ? ` · ${category.name}` : ""}
                  </div>
                </div>
              )}

              {item.issues.length > 0 ? (
                <div className="grid gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {item.issues.map((issue, index) => (
                    <div key={`${item.id}:issue:${index}`}>{issue}</div>
                  ))}
                </div>
              ) : null}

              {item.fieldWarnings.length > 0 ? (
                <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {item.fieldWarnings.map((warning, index) => (
                    <div key={`${item.id}:${warning.field}:${index}`}>
                      {warning.field}: {warning.message}
                    </div>
                  ))}
                </div>
              ) : null}

              {item.status === "duplicate" ? (
                <div className="grid gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Duplicate</Badge>
                    <span className="text-muted-foreground">
                      {counterpart
                        ? `Matches an existing ${counterpart.kind === "transaction" ? "transaction" : "captured item"}:`
                        : item.duplicateTransactionId || item.duplicateCaptureReviewItemId
                          ? "The matching record no longer exists."
                          : "Marked by hand. Nothing specific was matched."}
                    </span>
                  </div>
                  {counterpart ? (
                    <div className="grid gap-1 border-t border-border/50 pt-2 text-foreground">
                      <span>
                        {formatDate(counterpart.occurredOn)} ·{" "}
                        {accounts.find((entry) => entry.id === counterpart.accountId)?.name ??
                          "Unknown account"}
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{counterpart.payee || "Unlabeled"}</span>
                        <Money amount={counterpart.amount} currency={counterpart.currency} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isEditing ? (
                <CaptureReviewFields
                  draft={subject}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  onChange={(update) => setDraft((current) => (current ? update(current) : current))}
                />
              ) : (
                <>
                  <DetailSection title="Record">
                    <DetailRow label="Type">{transactionTypeLabels[subject.type]}</DetailRow>
                    {subject.currency !== "UGX" ? (
                      <>
                        <DetailRow label={`Original (${subject.currency})`}>
                          <Money amount={subject.originalAmount} currency={subject.currency} />
                        </DetailRow>
                        <DetailRow label="FX rate">
                          {subject.fxRateToUgx
                            ? `1 ${subject.currency} = ${subject.fxRateToUgx} UGX`
                            : "—"}
                        </DetailRow>
                      </>
                    ) : null}
                    {subject.feeAmount ? (
                      <DetailRow label="Fee — charges & tax">
                        <Money amount={subject.feeAmount} currency="UGX" tone="negative" signed />
                      </DetailRow>
                    ) : null}
                    {subject.note ? <DetailRow label="Note">{subject.note}</DetailRow> : null}
                    {typeof subject.statedBalance === "number" ? (
                      <DetailRow label="Stated balance">
                        <Money amount={subject.statedBalance} currency="UGX" />
                      </DetailRow>
                    ) : null}
                  </DetailSection>

                  <DetailSection title="Origin">
                    <DetailRow label="Captured from">
                      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {subject.source}
                        {subject.parserLabel ? (
                          <Badge variant="outline">{subject.parserLabel}</Badge>
                        ) : null}
                        <Badge variant="secondary">
                          {Math.round(subject.confidenceScore * 100)}%
                        </Badge>
                      </span>
                    </DetailRow>
                    <DetailRow label="Captured">
                      {formatDate(subject.createdAt, { alwaysYear: true })}
                    </DetailRow>
                    {item.resolvedAt ? (
                      <DetailRow label={item.status === "approved" ? "Approved" : "Rejected"}>
                        {formatDate(item.resolvedAt, { alwaysYear: true })}
                      </DetailRow>
                    ) : null}
                  </DetailSection>

                  {changes.length > 0 ? (
                    <DetailSection title="Your corrections">
                      {changes.map((change) => (
                        <DetailRow key={change.field} label={change.label}>
                          <span className="text-muted-foreground line-through">
                            {labelFor(change.field, change.from, accounts, categories)}
                          </span>{" "}
                          → {labelFor(change.field, change.to, accounts, categories)}
                        </DetailRow>
                      ))}
                    </DetailSection>
                  ) : null}

                  {item.status === "approved" ? (
                    <DetailSection title="In the ledger">
                      {ledgerTransaction ? (
                        <DetailRow label="Transaction">
                          <span className="font-mono text-xs">{ledgerTransaction.id}</span>
                        </DetailRow>
                      ) : (
                        <p className="py-1.5 text-sm text-muted-foreground">
                          The transaction this created has since been deleted.
                        </p>
                      )}
                    </DetailSection>
                  ) : null}
                </>
              )}
            </div>

            {isOpenItem ? (
              <div
                className="sticky bottom-0 mt-auto grid gap-2 border-t border-border/40 bg-background px-4 py-3"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={isSubmitting || !approvable}
                    title={approvable ? undefined : "Resolve the issues on this item before approving it."}
                    onClick={() => void onApprove(subject)}
                  >
                    Approve to ledger
                  </Button>
                  {isEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => void onUpdateItem(subject)}
                    >
                      Save changes
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {item.status === "duplicate" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() => void onClearDuplicate(item)}
                    >
                      Not a duplicate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() => void onMarkDuplicate(subject)}
                    >
                      Mark duplicate
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={isSubmitting}
                    onClick={() => void onReject(subject)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
