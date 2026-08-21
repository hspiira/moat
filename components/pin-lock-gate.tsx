"use client";

import { Fragment } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { lockState } = usePinLock();
  const status = lockState.status;

  if (status === "initializing") {
    return <div className="min-h-dvh bg-background" aria-hidden />;
  }

  const showApp = status === "no_pin" || status === "unlocked" || status === "unlocking";
  const showLock = status === "locked" || status === "unlocking";

  return (
    <>
      {showApp ? <Fragment key="app">{children}</Fragment> : null}
      {showLock ? <PinLockScreen key="lock" /> : null}
    </>
  );
}
