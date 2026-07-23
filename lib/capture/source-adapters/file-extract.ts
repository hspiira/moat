import { createEnvelopeFactory } from "@/lib/capture/source-adapters/factory";
import type { CaptureEnvelope } from "@/lib/types";

type Params = {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  capturedAt?: string;
};

const buildFileExtractEnvelope = createEnvelopeFactory<Params>("file_extract", (params) => [
  "file_extract",
  params.rawContent,
]);

export function createFileExtractEnvelope(params: Params): CaptureEnvelope {
  return buildFileExtractEnvelope(params);
}
