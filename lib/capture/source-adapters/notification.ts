import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope } from "@/lib/types";

export function createNotificationEnvelope(params: {
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
    source: "notification",
    rawContent: params.rawContent,
    contentHash: buildStableHash(["notification", params.sourceApp ?? "", params.rawContent], "envelope"),
    sourceTitle: params.sourceTitle,
    sourceApp: params.sourceApp,
    capturedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return envelope;
}
