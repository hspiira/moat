import { buildStableHash } from "@/lib/hash";
import type { CaptureEnvelope, CaptureEnvelopeSource } from "@/lib/types";

export type CaptureEnvelopeParams = {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
};

/**
 * Builds one `CaptureEnvelope` factory per capture source. Each source
 * adapter is a thin call into this — the only things that vary between
 * sources are the `source` tag and the fields folded into the content hash.
 */
export function createEnvelopeFactory<TParams extends CaptureEnvelopeParams>(
  source: CaptureEnvelopeSource,
  buildHashKey: (params: TParams) => string[],
) {
  return function createEnvelope(params: TParams): CaptureEnvelope {
    const timestamp = params.capturedAt ?? new Date().toISOString();

    return {
      id: `capture-envelope:${crypto.randomUUID()}`,
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
