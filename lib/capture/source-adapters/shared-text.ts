import { createEnvelopeFactory } from "@/lib/capture/source-adapters/factory";
import type { CaptureEnvelope } from "@/lib/types";

type Params = {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
};

const buildSharedTextEnvelope = createEnvelopeFactory<Params>("shared_text", (params) => [
  "shared_text",
  params.rawContent,
]);

export function createSharedTextEnvelope(params: Params): CaptureEnvelope {
  return buildSharedTextEnvelope(params);
}
