import { buildStableHash } from "@/lib/hash";
import type {
  CaptureConfidenceField,
  CaptureEnvelope,
  CaptureEnvelopeSource,
  CaptureReviewSnapshot,
  CaptureReviewItem,
  CorrectionLog,
  Transaction,
  TransactionSource,
} from "@/lib/types";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { buildCaptureFieldWarnings } from "@/lib/capture/confidence";

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

export function mapReviewItemToTransactionFields(
  item: CaptureReviewItem,
  userId: string,
  timestamp: string,
): Omit<Transaction, "id" | "captureEnvelopeId" | "captureReviewItemId"> {
  return {
    userId,
    accountId: item.accountId,
    type: item.type,
    amount: Math.abs(item.normalizedAmount),
    currency: item.currency,
    originalAmount: Math.abs(item.originalAmount),
    fxRateToUgx: item.currency === "UGX" ? undefined : item.fxRateToUgx,
    occurredOn: item.occurredOn,
    categoryId: item.categoryId,
    payee: item.payee.trim() || undefined,
    rawPayee: item.payee.trim() || undefined,
    note: item.note.trim() || undefined,
    reconciliationState: "reviewed",
    source: item.source,
    messageHash: item.messageHash,
    parserLabel: item.parserLabel,
    confidenceScore: item.confidenceScore,
    reviewedAt: timestamp,
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
    ...mapReviewItemToTransactionFields(params.item, params.userId, timestamp),
    captureEnvelopeId: params.item.envelopeId,
    captureReviewItemId: params.item.id,
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
