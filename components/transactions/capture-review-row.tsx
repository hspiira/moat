"use client";

import { IconAlertTriangle, IconCheck, IconChevronRight, IconCopy } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/format-date";
import { canApproveCaptureItem, describeCaptureReviewReason } from "@/lib/domain/capture-review";
import { occurrenceCountOf } from "@/lib/capture/occurrences";
import type { Account, CaptureReviewItem, Category } from "@/lib/types";

const inflowTypes = new Set(["income"]);

const feeFormatter = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });

export function CaptureReviewRow({
  item,
  accounts,
  categories,
  isSubmitting,
  onOpen,
  onApprove,
}: {
  item: CaptureReviewItem;
  accounts: Account[];
  categories: Category[];
  isSubmitting: boolean;
  onOpen: (item: CaptureReviewItem) => void;
  onApprove: (item: CaptureReviewItem) => void;
}) {
  const account = accounts.find((entry) => entry.id === item.accountId);
  const category = categories.find((entry) => entry.id === item.categoryId);
  const isInflow = inflowTypes.has(item.type);
  const label = item.payee || category?.name || "Unlabeled capture";
  const isSettled = item.status === "approved" || item.status === "rejected";
  const canApprove = canApproveCaptureItem(item);
  const reason = describeCaptureReviewReason(item);
  const occurrences = occurrenceCountOf(item);

  // Who and how much is what you decide on, so it leads. Where and when it
  // came from is context, and goes underneath.
  return (
    <div className="flex min-w-0 items-start gap-2">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Review ${label}`}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{label}</span>
            {occurrences > 1 ? (
              <span
                className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground"
                aria-label={`Captured ${occurrences} times`}
              >
                ×{occurrences}
              </span>
            ) : null}
            {item.status === "duplicate" ? (
              <IconCopy aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            ) : item.status === "needs_review" ? (
              <IconAlertTriangle aria-hidden className="size-3.5 shrink-0 text-neg" />
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {formatDate(item.occurredOn)} · {account?.name ?? "Unknown account"}
            {category ? ` · ${category.name}` : ""}
          </div>
          {/* The reason is why the row is here at all, so it wraps rather than
              losing its second half to an ellipsis. */}
          {reason ? (
            <div
              className={`text-xs leading-snug ${
                item.status === "duplicate" ? "text-muted-foreground" : "text-neg"
              }`}
            >
              {reason}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <Money
            amount={item.normalizedAmount}
            currency="UGX"
            tone={isInflow ? "positive" : "negative"}
            signed
            className="text-sm font-semibold sm:text-base"
          />
          {item.feeAmount ? (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              +{feeFormatter.format(item.feeAmount)} fee
            </span>
          ) : null}
        </div>
      </button>

      {isSettled ? (
        <span className="grid size-11 shrink-0 place-items-center">
          <IconChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </span>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="mt-1 size-11 shrink-0"
          disabled={isSubmitting || !canApprove}
          title={canApprove ? "Approve to ledger" : "Resolve the issues on this item before approving it."}
          aria-label={
            canApprove
              ? `Approve ${label} to ledger`
              : `Cannot approve ${label} yet. ${reason ?? "Resolve the issues on this item first."}`
          }
          onClick={() => onApprove(item)}
        >
          <IconCheck className="size-4" />
        </Button>
      )}
    </div>
  );
}
