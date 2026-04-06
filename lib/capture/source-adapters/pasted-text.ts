import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope } from "@/lib/types";

export function createPastedTextEnvelope(params: {
  userId: string;
  rawContent: string;
  capturedAt?: string;
}) {
  const timestamp = params.capturedAt ?? new Date().toISOString();

  const envelope: CaptureEnvelope = {
    id: `capture-envelope:${crypto.randomUUID()}`,
    userId: params.userId,
    source: "pasted_text",
    rawContent: params.rawContent,
    contentHash: buildStableHash(["pasted_text", params.rawContent], "envelope"),
    capturedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return envelope;
}
