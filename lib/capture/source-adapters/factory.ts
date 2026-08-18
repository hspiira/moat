import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope, CaptureEnvelopeSource } from "@/lib/types";
import { createId } from "@/lib/ids";

export type CaptureEnvelopeParams = {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
};

export function createEnvelopeFactory<TParams extends CaptureEnvelopeParams>(
  source: CaptureEnvelopeSource,
  buildHashKey: (params: TParams) => string[],
) {
  return function createEnvelope(params: TParams): CaptureEnvelope {
    const timestamp = params.capturedAt ?? new Date().toISOString();

    return {
      id: createId(),
      userId: params.userId,
      source,
      rawContent: params.rawContent,
      contentHash: buildStableHash(buildHashKey(params), "envelope"),
      sourceTitle: params.sourceTitle,
      sourceApp: params.sourceApp,
      capturedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };
}
