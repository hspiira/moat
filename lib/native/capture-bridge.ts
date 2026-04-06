import type { CaptureEnvelopeSource } from "@/lib/types";

export type NativeCapturePayload = {
  channel: "shared_text" | "notification";
  source: CaptureEnvelopeSource;
  rawContent: string;
  sourceTitle?: string;
  sourceApp?: string;
  occurredAt?: string;
};

export const MOAT_NATIVE_CAPTURE_EVENT = "moat:native-capture";

declare global {
  interface Window {
    moatNativeCapture?: {
      ingest: (payload: NativeCapturePayload) => void;
    };
  }
}

export function emitNativeCapturePayload(payload: NativeCapturePayload) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<NativeCapturePayload>(MOAT_NATIVE_CAPTURE_EVENT, {
      detail: payload,
    }),
  );
}

export function registerNativeCaptureGlobal() {
  if (typeof window === "undefined") return;

  window.moatNativeCapture = {
    ingest(payload) {
      emitNativeCapturePayload(payload);
    },
  };
}

export function subscribeToNativeCapture(handler: (payload: NativeCapturePayload) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<NativeCapturePayload>).detail;
    if (!detail?.rawContent?.trim()) return;
    handler(detail);
  };

  window.addEventListener(MOAT_NATIVE_CAPTURE_EVENT, listener);
  return () => window.removeEventListener(MOAT_NATIVE_CAPTURE_EVENT, listener);
}
