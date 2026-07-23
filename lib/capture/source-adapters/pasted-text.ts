import { createEnvelopeFactory } from "@/lib/capture/source-adapters/factory";
import type { CaptureEnvelope } from "@/lib/types";

type Params = {
  userId: string;
  rawContent: string;
  capturedAt?: string;
};

const buildPastedTextEnvelope = createEnvelopeFactory<Params>("pasted_text", (params) => [
  "pasted_text",
  params.rawContent,
]);

export function createPastedTextEnvelope(params: Params): CaptureEnvelope {
  return buildPastedTextEnvelope(params);
}
