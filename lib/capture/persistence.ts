import { announceLocalSave } from "@/lib/local-save";
import type { RepositoryBundle } from "@/lib/repositories/types";
import { normalizeAmountToUgx } from "@/lib/currency";
import {
  buildCaptureCandidatesFromEnvelope,
  createEnvelopeForSource,
  createEnvelopeFromNativePayload,
  deriveTransactionSourceFromEnvelopeSource,
} from "@/lib/capture/ingestion";
import { createCaptureReviewItem } from "@/lib/capture/review-queue";
import { applyTransactionRules } from "@/lib/domain/rules";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import type { NativeCapturePayload } from "@/lib/native/capture-bridge";
import type {
  CaptureEnvelope,
  CaptureReviewItem,
  Transaction,
  TransactionRule,
} from "@/lib/types";

function envelopesMatch(left: CaptureEnvelope, right: CaptureEnvelope) {
  return (
    left.source === right.source &&
    left.contentHash === right.contentHash &&
    (left.sourceApp ?? "") === (right.sourceApp ?? "") &&
    left.capturedAt === right.capturedAt
  );
}

function createRulePreview(params: {
  userId: string;
  reviewItem: CaptureReviewItem;
  rules: TransactionRule[];
  timestamp: string;
}) {
  const rulePreview: Transaction = {
    id: `transaction:preview:${params.reviewItem.id}`,
    userId: params.userId,
    accountId: params.reviewItem.accountId,
    type: params.reviewItem.type,
    amount: Math.abs(params.reviewItem.normalizedAmount),
    currency: params.reviewItem.currency,
    originalAmount: Math.abs(params.reviewItem.originalAmount),
    fxRateToUgx:
      params.reviewItem.currency === "UGX" ? undefined : params.reviewItem.fxRateToUgx,
    occurredOn: params.reviewItem.occurredOn,
    categoryId: params.reviewItem.categoryId,
    payee: params.reviewItem.payee.trim() || undefined,
    rawPayee: params.reviewItem.payee.trim() || undefined,
    note: params.reviewItem.note.trim() || undefined,
    reconciliationState: "reviewed",
    source: params.reviewItem.source,
    messageHash: params.reviewItem.messageHash,
    parserLabel: params.reviewItem.parserLabel,
    confidenceScore: params.reviewItem.confidenceScore,
    reviewedAt: params.timestamp,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };

  return applyTransactionRules(rulePreview, params.rules)?.proposedTransaction ?? rulePreview;
}

async function persistReviewItem(params: {
  repositories: RepositoryBundle;
  userId: string;
  reviewItem: CaptureReviewItem;
  rules: TransactionRule[];
  timestamp: string;
}) {
  const ruledPreview = createRulePreview({
    userId: params.userId,
    reviewItem: params.reviewItem,
    rules: params.rules,
    timestamp: params.timestamp,
  });

  await params.repositories.captureReviewItems.upsert({
    ...params.reviewItem,
    accountId: ruledPreview.accountId,
    type: ruledPreview.type as CaptureReviewItem["type"],
    categoryId: ruledPreview.categoryId,
    payee: ruledPreview.payee ?? params.reviewItem.payee,
    note: ruledPreview.note ?? params.reviewItem.note,
    updatedAt: params.timestamp,
  });
}

export async function persistCaptureEnvelopes(params: {
  repositories: RepositoryBundle;
  userId: string;
  accountId: string;
  envelopes: CaptureEnvelope[];
  fallbackFxRate?: number;
  sourceOverride?: Transaction["source"];
}) {
  const [categories, existingTransactions, existingReviewItems, rules, existingEnvelopes] =
    await Promise.all([
      params.repositories.categories.listByUser(params.userId),
      params.repositories.transactions.listByUser(params.userId),
      params.repositories.captureReviewItems.listByUser(params.userId),
      params.repositories.transactionRules.listByUser(params.userId),
      params.repositories.captureEnvelopes.listByUser(params.userId),
    ]);

  const timestamp = new Date().toISOString();
  const workingReviewItems = [...existingReviewItems];
  const workingEnvelopes = [...existingEnvelopes];
  let persistedEnvelopeCount = 0;
  let persistedReviewCount = 0;

  for (const envelope of params.envelopes) {
    if (workingEnvelopes.some((existingEnvelope) => envelopesMatch(existingEnvelope, envelope))) {
      continue;
    }

    const candidates = buildCaptureCandidatesFromEnvelope({
      envelope,
      source:
        params.sourceOverride ?? deriveTransactionSourceFromEnvelopeSource(envelope.source),
      accountId: params.accountId,
      categories,
      existingTransactions,
      existingReviewItems: workingReviewItems,
      fallbackFxRate: params.fallbackFxRate,
    });

    await params.repositories.captureEnvelopes.upsert(envelope);
    workingEnvelopes.push(envelope);
    persistedEnvelopeCount += 1;

    for (const candidate of candidates) {
      const reviewItem = createCaptureReviewItem({
        userId: params.userId,
        envelopeId: envelope.id,
        candidate,
        capturedAt: timestamp,
      });
      await persistReviewItem({
        repositories: params.repositories,
        userId: params.userId,
        reviewItem,
        rules,
        timestamp,
      });
      workingReviewItems.push(reviewItem);
      persistedReviewCount += 1;
    }
  }

  if (persistedReviewCount > 0) {
    announceLocalSave({
      entity: "transactions",
      savedAt: timestamp,
      message: "Captured items sent to review locally",
    });
  }

  return {
    persistedEnvelopeCount,
    persistedReviewCount,
    savedAt: timestamp,
  };
}

export async function persistReviewedCaptureCandidates(params: {
  repositories: RepositoryBundle;
  userId: string;
  candidates: ParsedCaptureCandidate[];
  source: "shared_text" | "pasted_text";
}) {
  if (params.candidates.length === 0) {
    return {
      persistedEnvelopeCount: 0,
      persistedReviewCount: 0,
      savedAt: new Date().toISOString(),
    };
  }

  const rules = await params.repositories.transactionRules.listByUser(params.userId);
  const timestamp = new Date().toISOString();
  let persistedReviewCount = 0;

  for (const candidate of params.candidates) {
    const normalizedAmount = normalizeAmountToUgx(
      candidate.originalAmount,
      candidate.currency,
      candidate.fxRateToUgx,
    );

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error("One or more captured rows has an invalid amount or FX rate.");
    }

    const envelope = createEnvelopeForSource({
      userId: params.userId,
      source: params.source,
      rawContent: candidate.rawText,
      capturedAt: timestamp,
    });
    const reviewItem = createCaptureReviewItem({
      userId: params.userId,
      envelopeId: envelope.id,
      candidate: {
        ...candidate,
        normalizedAmount,
      },
      capturedAt: timestamp,
    });

    await params.repositories.captureEnvelopes.upsert(envelope);
    await persistReviewItem({
      repositories: params.repositories,
      userId: params.userId,
      reviewItem,
      rules,
      timestamp,
    });
    persistedReviewCount += 1;
  }

  announceLocalSave({
    entity: "transactions",
    savedAt: timestamp,
    message: "Captured items sent to review locally",
  });

  return {
    persistedEnvelopeCount: params.candidates.length,
    persistedReviewCount,
    savedAt: timestamp,
  };
}

export async function ingestNativeCapturePayload(params: {
  repositories: RepositoryBundle;
  userId: string;
  accountId: string;
  payload: NativeCapturePayload;
}) {
  const envelope = createEnvelopeFromNativePayload({
    userId: params.userId,
    payload: params.payload,
  });

  return persistCaptureEnvelopes({
    repositories: params.repositories,
    userId: params.userId,
    accountId: params.accountId,
    envelopes: [envelope],
    sourceOverride: params.payload.channel === "notification" ? "notification" : "sms",
  });
}
