import type {
  CaptureReviewItem,
  CaptureReviewSnapshot,
  CorrectionLog,
} from "@/lib/types";
import { createId } from "@/lib/ids";

export function createCorrectionLog(params: {
  userId: string;
  item: CaptureReviewItem;
  approvedSnapshot: CaptureReviewSnapshot;
  createdAt?: string;
}): CorrectionLog {
  return {
    id: createId(),
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
