// Decides what the capture inbox may do with a review item: which section it
// belongs to, whether it can still be edited, whether it may reach the ledger,
// what it duplicates, and what the user changed before approving it.
//
// This lives apart from the queue component on purpose. The duplicate ledger
// rows the inbox used to produce came from one component deciding both "which
// fields are editable" and "which actions are available" — an approved item
// kept an enabled Approve button because nothing outside the render said no.

import type { CaptureReviewItem, CaptureReviewStatus, SupportedCurrency, Transaction } from "@/lib/types";

/**
 * Sections are not statuses. "new", "needs_review" and "duplicate" all mean the
 * same thing to the person reviewing — open, waiting on a decision — and differ
 * only in why, which the row already shows with a status glyph. Three tabs fit a
 * phone without scrolling; five did not.
 */
export type CaptureReviewSection = "to_review" | "approved" | "rejected";

export const captureReviewSections = [
  "to_review",
  "approved",
  "rejected",
] as const satisfies readonly CaptureReviewSection[];

export const captureReviewSectionLabels: Record<CaptureReviewSection, string> = {
  to_review: "To review",
  approved: "Approved",
  rejected: "Rejected",
};

const sectionStatuses: Record<CaptureReviewSection, CaptureReviewStatus[]> = {
  to_review: ["new", "needs_review", "duplicate"],
  approved: ["approved"],
  rejected: ["rejected"],
};

export function getSectionOf(item: CaptureReviewItem): CaptureReviewSection {
  if (item.status === "approved") return "approved";
  if (item.status === "rejected") return "rejected";
  return "to_review";
}

function resolvedAtOf(item: CaptureReviewItem) {
  return item.resolvedAt ?? item.reviewedAt ?? item.updatedAt;
}

export function getSectionItems(items: CaptureReviewItem[], section: CaptureReviewSection) {
  const matching = items.filter((item) => sectionStatuses[section].includes(item.status));

  if (section !== "to_review") {
    return [...matching].sort((a, b) => resolvedAtOf(b).localeCompare(resolvedAtOf(a)));
  }

  // Approvable items first, so a batch of cleanly parsed messages can be
  // cleared with one tap each before working through the exceptions.
  return [...matching].sort((a, b) => {
    const byReadiness = Number(canApproveCaptureItem(b)) - Number(canApproveCaptureItem(a));
    return byReadiness !== 0 ? byReadiness : b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getSectionCounts(items: CaptureReviewItem[]): Record<CaptureReviewSection, number> {
  const counts = Object.fromEntries(
    captureReviewSections.map((section) => [section, 0]),
  ) as Record<CaptureReviewSection, number>;

  for (const item of items) {
    counts[getSectionOf(item)] += 1;
  }

  return counts;
}

/** Approved and rejected items are records of a decision, not drafts. */
export function isCaptureItemEditable(item: CaptureReviewItem) {
  return item.status !== "approved" && item.status !== "rejected";
}

export function canApproveCaptureItem(item: CaptureReviewItem) {
  if (item.status === "approved" || item.status === "rejected") return false;
  // A stale ledger link outranks the status field: an approved item that was
  // pushed back to "new" still has its transaction, and approving it again
  // would write a second one.
  if (item.approvedTransactionId) return false;
  return item.issues.length === 0;
}

export type DuplicateCounterpart = {
  kind: "transaction" | "capture";
  occurredOn: string;
  accountId: string;
  payee: string;
  amount: number;
  currency: SupportedCurrency;
  reference: string;
};

export function resolveDuplicateCounterpart(
  item: CaptureReviewItem,
  transactions: Transaction[],
  items: CaptureReviewItem[],
): DuplicateCounterpart | null {
  if (item.duplicateTransactionId) {
    const match = transactions.find((entry) => entry.id === item.duplicateTransactionId);
    if (match) {
      return {
        kind: "transaction",
        occurredOn: match.occurredOn,
        accountId: match.accountId,
        payee: match.payee ?? match.rawPayee ?? "",
        amount: match.amount,
        currency: match.currency,
        reference: match.id,
      };
    }
  }

  if (item.duplicateCaptureReviewItemId && item.duplicateCaptureReviewItemId !== item.id) {
    const match = items.find((entry) => entry.id === item.duplicateCaptureReviewItemId);
    if (match) {
      return {
        kind: "capture",
        occurredOn: match.occurredOn,
        accountId: match.accountId,
        payee: match.payee,
        amount: match.normalizedAmount,
        currency: match.currency,
        reference: match.id,
      };
    }
  }

  // Either nothing was ever linked, or the linked record has since been
  // deleted. Both cases are the caller's to explain.
  return null;
}

export type CaptureFieldChange = {
  field: string;
  label: string;
  from: string | number | undefined;
  to: string | number | undefined;
};

const comparedFields = [
  ["occurredOn", "Date"],
  ["accountId", "Account"],
  ["type", "Type"],
  ["originalAmount", "Amount"],
  ["currency", "Currency"],
  ["feeAmount", "Fee"],
  ["categoryId", "Category"],
  ["payee", "Payee"],
  ["note", "Note"],
] as const;

/** What the user corrected between the parsed capture and its current state. */
export function diffCaptureFromOriginal(item: CaptureReviewItem): CaptureFieldChange[] {
  const changes: CaptureFieldChange[] = [];

  for (const [field, label] of comparedFields) {
    const from = item.originalSnapshot[field];
    const to = item[field];
    if (from !== to) {
      changes.push({ field, label, from, to });
    }
  }

  return changes;
}
