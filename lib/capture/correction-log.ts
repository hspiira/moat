import type {
  CaptureReviewItem,
  CaptureReviewSnapshot,
  CorrectionLog,
} from "@/lib/types";

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
