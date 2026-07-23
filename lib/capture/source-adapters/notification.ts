import { createEnvelopeFactory } from "@/lib/capture/source-adapters/factory";
import type { CaptureEnvelope } from "@/lib/types";

type Params = {
  userId: string;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt?: string;
};

const buildNotificationEnvelope = createEnvelopeFactory<Params>("notification", (params) => [
  "notification",
  params.sourceApp ?? "",
  params.rawContent,
]);

export function createNotificationEnvelope(params: Params): CaptureEnvelope {
  return buildNotificationEnvelope(params);
}
