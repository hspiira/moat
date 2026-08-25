import type { CaptureReviewItem, CaptureReviewStatus, SupportedCurrency, Transaction } from "@/lib/types";

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

export function isCaptureItemEditable(item: CaptureReviewItem) {
  return item.status !== "approved" && item.status !== "rejected";
}

export function canApproveCaptureItem(item: CaptureReviewItem) {
  if (item.status === "approved" || item.status === "rejected") return false;
  if (item.approvedTransactionId) return false;
  return item.issues.length === 0;
}

/**
 * The short reason a capture is being held, for a list row that has space for
 * one line. The status alone only says that something is wrong.
 *
 * Read from the issue list first and the field warnings second, because the
 * status is decided from what the parse raised while the issues are worked out
 * again from the amount and currency, and the two can disagree.
 */
export function describeCaptureReviewReason(item: CaptureReviewItem): string | null {
  if (item.status === "duplicate") {
    return item.duplicateTransactionId ? "Already in the ledger" : "Already in the inbox";
  }

  if (item.status !== "needs_review") return null;

  return (
    item.issues[0] ??
    item.fieldWarnings.find((warning) => warning.level === "warning")?.message ??
    "Needs a second look"
  );
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
