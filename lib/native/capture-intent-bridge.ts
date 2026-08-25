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

/**
 * Takes whatever the Shortcuts action has queued.
 *
 * The plugin is absent on the web and on any build that predates it, and a
 * missing action is not a failure worth surfacing, so nothing is thrown either
 * way.
 */
export async function takePendingIntentCaptures(): Promise<NativeCapturePayload[]> {
  if (typeof window === "undefined") return [];

  try {
    const { registerPlugin } = await import("@capacitor/core");
    const plugin = registerPlugin<MoatCapturePlugin>("MoatCapture");
    const result = await plugin.takePending();
    return toNativeCapturePayloads(result?.payloads);
  } catch {
    return [];
  }
}
