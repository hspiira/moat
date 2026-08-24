import type {
  CaptureConfidenceField,
  CaptureReviewSnapshot,
  CaptureReviewItem,
} from "@/lib/types";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { buildCaptureFieldWarnings } from "@/lib/capture/confidence";
import { createId } from "@/lib/ids";

function resolveReviewStatus(candidate: ParsedCaptureCandidate): CaptureReviewItem["status"] {
  if (candidate.duplicate) return "duplicate";
  if (candidate.issues.length > 0) return "needs_review";
  return "new";
}

const fieldWarningIssueMessages: Partial<Record<CaptureConfidenceField, string>> = {
  amount: "Invalid amount",
  currency: "Missing FX rate",
};

export function validateCaptureReviewItem(item: Pick<
  CaptureReviewItem,
  "originalAmount" | "currency" | "fxRateToUgx" | "duplicateTransactionId"
>) {
  const issues = buildCaptureFieldWarnings({
    originalAmount: item.originalAmount,
    currency: item.currency,
    fxRateToUgx: item.fxRateToUgx,
  })
    .filter((warning) => warning.level === "warning" && warning.field in fieldWarningIssueMessages)
    .map((warning) => fieldWarningIssueMessages[warning.field] as string);

  if (item.duplicateTransactionId) {
    issues.push("Likely duplicate");
  }

  return issues;
}

export function createCaptureReviewItem(params: {
  userId: string;
  envelopeId: string;
  candidate: ParsedCaptureCandidate;
  capturedAt?: string;
}): CaptureReviewItem {
  const timestamp = params.capturedAt ?? new Date().toISOString();
  const originalSnapshot: CaptureReviewSnapshot = {
    accountId: params.candidate.accountId,
    occurredOn: params.candidate.occurredOn,
    originalAmount: params.candidate.originalAmount,
    currency: params.candidate.currency,
    fxRateToUgx: params.candidate.fxRateToUgx,
    feeAmount: params.candidate.feeAmount,
    statedBalance: params.candidate.statedBalance,
    normalizedAmount: params.candidate.normalizedAmount,
    type: params.candidate.type,
    destinationAccountId: params.candidate.destinationAccountId,
    categoryId: params.candidate.categoryId,
    payee: params.candidate.payee,
    note: params.candidate.note,
    parserLabel: params.candidate.parserLabel,
    confidenceScore: params.candidate.confidence,
    issues: validateCaptureReviewItem({
      originalAmount: params.candidate.originalAmount,
      currency: params.candidate.currency,
      fxRateToUgx: params.candidate.fxRateToUgx,
      duplicateTransactionId: params.candidate.duplicateTransactionId,
    }),
    fieldWarnings: params.candidate.fieldWarnings,
  };

  return {
    id: createId(),
    userId: params.userId,
    envelopeId: params.envelopeId,
    source: params.candidate.source,
    accountId: params.candidate.accountId,
    occurredOn: params.candidate.occurredOn,
    originalAmount: params.candidate.originalAmount,
    currency: params.candidate.currency,
    fxRateToUgx: params.candidate.fxRateToUgx,
    feeAmount: params.candidate.feeAmount,
    statedBalance: params.candidate.statedBalance,
    normalizedAmount: params.candidate.normalizedAmount,
    type: params.candidate.type,
    destinationAccountId: params.candidate.destinationAccountId,
    categoryId: params.candidate.categoryId,
    payee: params.candidate.payee,
    note: params.candidate.note,
    messageHash: params.candidate.messageHash,
    parserLabel: params.candidate.parserLabel,
    confidenceScore: params.candidate.confidence,
    status: resolveReviewStatus(params.candidate),
    issues: originalSnapshot.issues,
    fieldWarnings: params.candidate.fieldWarnings,
    originalSnapshot,
    duplicateTransactionId: params.candidate.duplicateTransactionId,
    duplicateCaptureReviewItemId: params.candidate.duplicateCaptureReviewItemId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getOpenCaptureReviewItems(items: CaptureReviewItem[]) {
  return items.filter((item) => item.status !== "approved" && item.status !== "rejected");
}
