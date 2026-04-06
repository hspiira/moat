import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope } from "@/lib/types";

export function createFileExtractEnvelope(params: {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  capturedAt?: string;
}) {
  const timestamp = params.capturedAt ?? new Date().toISOString();

  const envelope: CaptureEnvelope = {
    id: `capture-envelope:${crypto.randomUUID()}`,
    userId: params.userId,
    source: "file_extract",
    rawContent: params.rawContent,
    contentHash: buildStableHash(["file_extract", params.rawContent], "envelope"),
    sourceTitle: params.sourceTitle,
    capturedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return envelope;
}
