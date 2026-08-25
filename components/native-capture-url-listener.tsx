"use client";

import { useEffect } from "react";

import {
  enqueueNativeCapturePayload,
  setPendingNativeCaptureRouteHint,
} from "@/lib/native/capture-bridge";
import { parseNativeCaptureUrl } from "@/lib/native/capture-deep-link";
import { isNativeApp } from "@/lib/sync/native-sign-in";

/** Receives the narrow moat://capture contract used by iOS Shortcuts. */
export function NativeCaptureUrlListener() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;
    let remove: (() => void) | undefined;
    const seenUrls = new Set<string>();

    function handleUrl(rawUrl: string) {
      if (seenUrls.has(rawUrl)) return;
      seenUrls.add(rawUrl);

      const payload = parseNativeCaptureUrl(rawUrl);
      if (!payload) return;

      setPendingNativeCaptureRouteHint("/transactions/review/capture");
      enqueueNativeCapturePayload(payload);
    }

    void (async () => {
      const { App } = await import("@capacitor/app");
      if (cancelled) return;

      const handle = await App.addListener("appUrlOpen", (event) => handleUrl(event.url));
      remove = () => void handle.remove();

      const launch = await App.getLaunchUrl();
      if (!cancelled && launch?.url) handleUrl(launch.url);
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return null;
}
