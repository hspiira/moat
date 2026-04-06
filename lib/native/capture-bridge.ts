import type { CaptureEnvelopeSource } from "@/lib/types";

// Bridges native capture payloads into the web app by queueing, dispatching, and subscribing to host-provided capture events.

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
    __moatPendingCapturePayloads?: NativeCapturePayload[];
    __moatNativeCaptureListenerCount?: number;
  }
}

function queueNativeCapturePayload(payload: NativeCapturePayload) {
  if (typeof window === "undefined") return;

  window.__moatPendingCapturePayloads = window.__moatPendingCapturePayloads ?? [];
  window.__moatPendingCapturePayloads.push(payload);
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
      if ((window.__moatNativeCaptureListenerCount ?? 0) > 0) {
        emitNativeCapturePayload(payload);
        return;
      }

      queueNativeCapturePayload(payload);
    },
  };

  const pending = window.__moatPendingCapturePayloads ?? [];
  if (pending.length > 0) {
    window.__moatPendingCapturePayloads = [];
    pending.forEach((payload) => emitNativeCapturePayload(payload));
  }
}

export function syncNativeCaptureSettings(settingsJson: string) {
  if (typeof window === "undefined") return;
  window.moatHostBridge?.updateCaptureSettings?.(settingsJson);
}

export function getPendingNativeCaptureRouteHint(): string | null {
  if (typeof window === "undefined") return null;
  const routeHint = window.moatHostBridge?.getPendingCaptureRouteHint?.();
  return typeof routeHint === "string" && routeHint.trim() ? routeHint : null;
}

export function clearPendingNativeCaptureRouteHint() {
  if (typeof window === "undefined") return;
  window.moatHostBridge?.clearPendingCaptureRouteHint?.();
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

  window.__moatNativeCaptureListenerCount = (window.__moatNativeCaptureListenerCount ?? 0) + 1;
  window.addEventListener(MOAT_NATIVE_CAPTURE_EVENT, listener);

  const pending = window.__moatPendingCapturePayloads ?? [];
  if (pending.length > 0) {
    window.__moatPendingCapturePayloads = [];
    pending.forEach((payload) => {
      if (payload.rawContent?.trim()) {
        handler(payload);
      }
    });
  }

  return () => {
    window.removeEventListener(MOAT_NATIVE_CAPTURE_EVENT, listener);
    window.__moatNativeCaptureListenerCount = Math.max(
      0,
      (window.__moatNativeCaptureListenerCount ?? 1) - 1,
    );
  };
}
