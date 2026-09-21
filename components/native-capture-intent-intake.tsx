"use client";

import { useCallback, useEffect } from "react";

import { enqueueNativeCapturePayload } from "@/lib/native/capture-bridge";
import { takePendingIntentCaptures } from "@/lib/native/capture-intent-bridge";
import { isIosApp } from "@/lib/native/platform";

/**
 * Takes what the iOS Shortcuts action queued while Moat was not on screen.
 *
 * The action deliberately does not open the app, so an automation can run on
 * every message without interrupting anything. That means nothing is delivered
 * at the moment of capture, and this is where it is collected instead: on
 * arrival, and again whenever the app comes back to the front.
 */
export function NativeCaptureIntentIntake() {
  const drain = useCallback(async () => {
    for (const payload of await takePendingIntentCaptures()) {
      enqueueNativeCapturePayload(payload);
    }
  }, []);

  useEffect(() => {
    if (!isIosApp()) return;

    void drain();

    function onVisible() {
      if (document.visibilityState === "visible") void drain();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [drain]);

  return null;
}
