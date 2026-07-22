"use client";

import { useEffect, useRef, useState } from "react";
import { IconLockFilled, IconLockOpen } from "@tabler/icons-react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";
import { MoatRing } from "@/components/moat/moat-ring";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const { lockState } = usePinLock();
  const [revealing, setRevealing] = useState(false);
  const prevStatus = useRef(lockState.status);

  // When we cross from locked → unlocked, play the reveal over the app before
  // it's shown. Skipped for reduced-motion users (they get an instant reveal).
  useEffect(() => {
    const wasLocked = prevStatus.current === "locked";
    prevStatus.current = lockState.status;
    if (wasLocked && lockState.status === "unlocked") {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRevealing(true);
      }
    }
  }, [lockState.status]);

  // Neutral splash while resolving client-only lock state — keeps the server
  // and first client render identical (no hydration mismatch) and never
  // flashes app content before a locked screen is shown.
  if (lockState.status === "initializing") {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  if (lockState.status === "locked") {
    return <PinLockScreen />;
  }

  return (
    <>
      {children}
      {revealing ? <UnlockReveal onDone={() => setRevealing(false)} /> : null}
    </>
  );
}

/**
 * The unlock reveal. Mirrors the lock screen's brand mark — a closed moat ring
 * with a padlock — then lifts it to centre, opens the lock with a glow, and
 * fades the veil away to reveal the app underneath.
 */
function UnlockReveal({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 960);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-100 grid place-items-center bg-background"
      style={{ animation: "moat-unlock-veil 0.96s ease-in forwards" }}
      aria-hidden
    >
      <div
        className="relative grid place-items-center"
        style={{ animation: "moat-unlock-rise 0.7s cubic-bezier(0.2,0.8,0.2,1) forwards" }}
      >
        <span
          className="absolute size-20 rounded-full bg-primary/30 blur-xl"
          style={{ animation: "moat-unlock-glow 0.9s ease-out forwards" }}
        />
        <MoatRing value={1} size={80} thickness={5} ariaLabel="Unlocked" />
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ animation: "moat-lock-out 0.9s ease-in-out forwards" }}
        >
          <IconLockFilled className="size-6 text-primary" />
        </span>
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ animation: "moat-lock-in 0.9s ease-in-out forwards" }}
        >
          <IconLockOpen className="size-6 text-primary" />
        </span>
      </div>
    </div>
  );
}
