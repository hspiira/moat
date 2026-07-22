import type { CaptureReviewItem, Transaction } from "@/lib/types";

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
