"use client";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { lockState } = usePinLock();

  // Neutral splash while resolving client-only lock state — keeps the server
  // and first client render identical (no hydration mismatch) and never
  // flashes app content before a locked screen is shown.
  if (lockState.status === "initializing") {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  if (lockState.status === "locked") {
    return <PinLockScreen />;
  }

  return <>{children}</>;
}

