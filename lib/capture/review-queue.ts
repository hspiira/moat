import { buildStableHash } from "@/lib/hash";
import type {
  CaptureEnvelope,
  CaptureEnvelopeSource,
  CaptureReviewSnapshot,
  CaptureReviewItem,
  CorrectionLog,
  Transaction,
  TransactionSource,
} from "@/lib/types";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";

function resolveReviewStatus(candidate: ParsedCaptureCandidate): CaptureReviewItem["status"] {
  if (candidate.duplicate) return "duplicate";
  if (candidate.issues.length > 0) return "needs_review";
  return "new";
}

export function validateCaptureReviewItem(item: Pick<
  CaptureReviewItem,
  "originalAmount" | "currency" | "fxRateToUgx" | "duplicateTransactionId"
>) {
  const issues: string[] = [];

  if (!Number.isFinite(item.originalAmount) || item.originalAmount <= 0) {
    issues.push("Invalid amount");
  }

  if (item.currency !== "UGX" && (!item.fxRateToUgx || item.fxRateToUgx <= 0)) {
    issues.push("Missing FX rate");
  }

  if (item.duplicateTransactionId) {
    issues.push("Likely duplicate");
  }

  return issues;
}

export function createCaptureEnvelope(params: {
  userId: string;
  rawContent: string;
  source: CaptureEnvelopeSource;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
}): CaptureEnvelope {
  const timestamp = params.capturedAt ?? new Date().toISOString();

  return {
    id: `capture-envelope:${crypto.randomUUID()}`,
    userId: params.userId,
    source: params.source,
    rawContent: params.rawContent,
    contentHash: buildStableHash([params.source, params.rawContent], "envelope"),
    sourceTitle: params.sourceTitle,
    sourceApp: params.sourceApp,
    capturedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
    normalizedAmount: params.candidate.normalizedAmount,
    type: params.candidate.type,
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
    id: `capture-review:${crypto.randomUUID()}`,
    userId: params.userId,
    envelopeId: params.envelopeId,
    source: params.candidate.source,
    accountId: params.candidate.accountId,
    occurredOn: params.candidate.occurredOn,
    originalAmount: params.candidate.originalAmount,
    currency: params.candidate.currency,
    fxRateToUgx: params.candidate.fxRateToUgx,
    normalizedAmount: params.candidate.normalizedAmount,
    type: params.candidate.type,
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

export function buildTransactionFromCaptureReviewItem(params: {
  item: CaptureReviewItem;
  userId: string;
  createdAt?: string;
}): Transaction {
  const timestamp = params.createdAt ?? new Date().toISOString();

  return {
    id: `transaction:${crypto.randomUUID()}`,
    userId: params.userId,
    accountId: params.item.accountId,
    type: params.item.type,
    amount: Math.abs(params.item.normalizedAmount),
    currency: params.item.currency,
    originalAmount: Math.abs(params.item.originalAmount),
    fxRateToUgx: params.item.currency === "UGX" ? undefined : params.item.fxRateToUgx,
    occurredOn: params.item.occurredOn,
    categoryId: params.item.categoryId,
    payee: params.item.payee.trim() || undefined,
    rawPayee: params.item.payee.trim() || undefined,
    note: params.item.note.trim() || undefined,
    reconciliationState: "reviewed",
    source: params.item.source,
    messageHash: params.item.messageHash,
    captureEnvelopeId: params.item.envelopeId,
    captureReviewItemId: params.item.id,
    parserLabel: params.item.parserLabel,
    confidenceScore: params.item.confidenceScore,
    reviewedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getOpenCaptureReviewItems(items: CaptureReviewItem[]) {
  return items.filter((item) => item.status !== "approved" && item.status !== "rejected");
}

export function createCorrectionLog(params: {
  userId: string;
  item: CaptureReviewItem;
  approvedSnapshot: CaptureReviewSnapshot;
  createdAt?: string;
}): CorrectionLog {
  return {
    id: `correction-log:${crypto.randomUUID()}`,
    userId: params.userId,
    reviewItemId: params.item.id,
    envelopeId: params.item.envelopeId,
    source: params.item.source,
    parserLabel: params.item.parserLabel,
    confidenceScore: params.item.confidenceScore,
    originalSnapshot: params.item.originalSnapshot,
    approvedSnapshot: params.approvedSnapshot,
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

export function inferEnvelopeSourceFromTransactionSource(
  source: TransactionSource,
  hasSharedInput: boolean,
): CaptureEnvelopeSource {
  if (source === "notification") return "notification";
  if (hasSharedInput) return "shared_text";
  return "pasted_text";
}
