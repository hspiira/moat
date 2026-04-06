import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope } from "@/lib/types";

export function createSharedTextEnvelope(params: {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
}) {
  const timestamp = params.capturedAt ?? new Date().toISOString();

  const envelope: CaptureEnvelope = {
    id: `capture-envelope:${crypto.randomUUID()}`,
    userId: params.userId,
    source: "shared_text",
    rawContent: params.rawContent,
    contentHash: buildStableHash(["shared_text", params.rawContent], "envelope"),
    sourceTitle: params.sourceTitle,
    sourceApp: params.sourceApp,
    capturedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return envelope;
}
