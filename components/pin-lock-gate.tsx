"use client";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { lockState } = usePinLock();

  if (lockState.status === "locked") {
    return <PinLockScreen />;
  }

  return <>{children}</>;
}

