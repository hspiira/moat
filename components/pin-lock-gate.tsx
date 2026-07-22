"use client";

import { Fragment } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { lockState } = usePinLock();
  const status = lockState.status;

  // Neutral splash while resolving client-only lock state — keeps the server
  // and first client render identical (no hydration mismatch) and never
  // flashes app content before the lock screen is shown.
  if (status === "initializing") {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  // During `unlocking` both mount: the app renders behind while the same lock
  // screen (kept alive by its stable key) plays its reveal on top and then
  // calls completeUnlock. The stable keys stop React from remounting either.
  const showApp = status === "unlocked" || status === "unlocking";
  const showLock = status === "locked" || status === "unlocking";

  return (
    <>
      {showApp ? <Fragment key="app">{children}</Fragment> : null}
      {showLock ? <PinLockScreen key="lock" /> : null}
    </>
  );
}
