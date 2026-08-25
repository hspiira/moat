import type { NativeCapturePayload } from "./capture-bridge";
import { readCaptureTimestamp } from "./capture-timestamp";

/** What the iOS Shortcuts action queues, before any of it is trusted. */
export type PendingIntentCapture = {
  message?: unknown;
  sender?: unknown;
  occurredAt?: unknown;
};

export type MoatCapturePlugin = {
  takePending(): Promise<{ payloads?: unknown }>;
};

/**
 * Told apart on purpose. A queue that answered and was empty means the action
 * never wrote; a queue that could not be reached means the action is not
 * installed in this build. Swallowing both as "nothing to do" is what made the
 * difference invisible.
 */
export type IntentCaptureDrain =
  | { status: "ok"; payloads: NativeCapturePayload[] }
  | { status: "unreachable"; detail: string };

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * A queued capture is written by a Shortcut someone wired up, so it is checked
 * the same way the url route is checked rather than trusted for having come
 * through a native call.
 */
export function toNativeCapturePayload(
  pending: PendingIntentCapture,
): NativeCapturePayload | null {
  const rawContent = readString(pending.message);
  if (!rawContent) return null;

  return {
    channel: "shared_text",
    source: "shared_text",
    rawContent,
    sourceTitle: readString(pending.sender),
    occurredAt: readCaptureTimestamp(readString(pending.occurredAt)),
  };
}

export function toNativeCapturePayloads(payloads: unknown): NativeCapturePayload[] {
  if (!Array.isArray(payloads)) return [];

  return payloads
    .filter((entry): entry is PendingIntentCapture => typeof entry === "object" && entry !== null)
    .map(toNativeCapturePayload)
    .filter((payload): payload is NativeCapturePayload => payload !== null);
}

/** Takes whatever the Shortcuts action has queued, and says so when it cannot. */
export async function drainIntentCaptures(): Promise<IntentCaptureDrain> {
  if (typeof window === "undefined") {
    return { status: "unreachable", detail: "Not running in the app." };
  }

  try {
    const { registerPlugin } = await import("@capacitor/core");
    const plugin = registerPlugin<MoatCapturePlugin>("MoatCapture");
    const result = await plugin.takePending();
    return { status: "ok", payloads: toNativeCapturePayloads(result?.payloads) };
  } catch (error) {
    return {
      status: "unreachable",
      detail: error instanceof Error ? error.message : "The capture action did not answer.",
    };
  }
}

export async function takePendingIntentCaptures(): Promise<NativeCapturePayload[]> {
  const drained = await drainIntentCaptures();
  return drained.status === "ok" ? drained.payloads : [];
}
