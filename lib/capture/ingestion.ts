import { parseCaptureEnvelope } from "@/lib/capture/pipeline";
import { createFileExtractEnvelope } from "@/lib/capture/source-adapters/file-extract";
import { createNotificationEnvelope } from "@/lib/capture/source-adapters/notification";
import { createPastedTextEnvelope } from "@/lib/capture/source-adapters/pasted-text";
import { createSharedTextEnvelope } from "@/lib/capture/source-adapters/shared-text";
import type { NativeCapturePayload } from "@/lib/native/capture-bridge";
import type { CaptureEnvelope, CaptureReviewItem, Category, Transaction, TransactionSource } from "@/lib/types";

export function createEnvelopeForSource(params: {
  userId: string;
  source: CaptureEnvelope["source"];
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
}) {
  if (params.source === "shared_text") {
    return createSharedTextEnvelope(params);
  }

  if (params.source === "notification") {
    return createNotificationEnvelope(params);
  }

  if (params.source === "file_extract") {
    return createFileExtractEnvelope(params);
  }

  return createPastedTextEnvelope({
    userId: params.userId,
    rawContent: params.rawContent,
    capturedAt: params.capturedAt,
  });
}

export function deriveTransactionSourceFromEnvelopeSource(
  source: CaptureEnvelope["source"],
): TransactionSource {
  if (source === "notification") return "notification";
  return "sms";
}

export function buildCaptureCandidatesFromEnvelope(params: {
  envelope: CaptureEnvelope;
  accountId: string;
  categories: Category[];
  existingTransactions: Transaction[];
  existingReviewItems?: CaptureReviewItem[];
  fallbackFxRate?: number;
  source?: TransactionSource;
}) {
  return parseCaptureEnvelope({
    envelope: params.envelope,
    source: params.source ?? deriveTransactionSourceFromEnvelopeSource(params.envelope.source),
    accountId: params.accountId,
    fallbackFxRate: params.fallbackFxRate,
    categories: params.categories,
    existingTransactions: params.existingTransactions,
    existingReviewItems: params.existingReviewItems,
  });
}

export function createEnvelopeFromNativePayload(params: {
  userId: string;
  payload: NativeCapturePayload;
}) {
  return createEnvelopeForSource({
    userId: params.userId,
    source: params.payload.source,
    rawContent: params.payload.rawContent,
    sourceTitle: params.payload.sourceTitle,
    sourceApp: params.payload.sourceApp,
    capturedAt: params.payload.occurredAt,
  });
}
