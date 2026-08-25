import type { NativeCapturePayload } from "./capture-bridge";
import { readCaptureTimestamp } from "./capture-timestamp";

const CAPTURE_SCHEME = "moat:";
const CAPTURE_HOST = "capture";

/**
 * Parse the deliberately small URL contract used by iOS Shortcuts.
 *
 * A custom URL is untrusted input, so it is accepted only for the capture
 * scheme/host and always enters the existing review queue as shared text.
 */
export function parseNativeCaptureUrl(rawUrl: string): NativeCapturePayload | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== CAPTURE_SCHEME || url.hostname !== CAPTURE_HOST) {
    return null;
  }

  const rawContent = url.searchParams.get("text")?.trim();
  if (!rawContent) {
    return null;
  }

  const sourceTitle = url.searchParams.get("sender")?.trim();

  return {
    channel: "shared_text",
    source: "shared_text",
    rawContent,
    sourceTitle: sourceTitle || undefined,
    occurredAt: readCaptureTimestamp(url.searchParams.get("occurredAt")),
  };
}
