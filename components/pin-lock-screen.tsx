"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconBackspace, IconFingerprint, IconLockFilled, IconLockOpen } from "@tabler/icons-react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";
import { MoatRing } from "@/components/moat/moat-ring";
import { cn } from "@/lib/utils";

export function PinLockScreen() {
  const {
    unlock,
    getUnlockLockoutMs,
    getAttemptsUntilLockout,
    getCurrentLockoutTotalMs,
    getPinLength,
    completeUnlock,
    hasPasskey,
    unlockWithPasskey,
    lockState,
  } = usePinLock();
  return (
    <LockScreen
      unlock={unlock}
      getUnlockLockoutMs={getUnlockLockoutMs}
      getAttemptsUntilLockout={getAttemptsUntilLockout}
      getCurrentLockoutTotalMs={getCurrentLockoutTotalMs}
      getPinLength={getPinLength}
      completeUnlock={completeUnlock}
      hasPasskey={hasPasskey}
      unlockWithPasskey={unlockWithPasskey}
      exiting={lockState.status === "unlocking"}
    />
  );
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function formatLockoutMessage(lockoutMs: number): string {
  const seconds = Math.ceil(lockoutMs / 1000);
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds}s.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const MAX_PIN_LENGTH = 12;

/**
 * The live padlock: a moat ring with an orbiting accent and a lock that opens.
 * During a lockout the ring drains, then visibly refills as the wait expires.
 */
function LockMark({ spinning, open, progress = 1 }: { spinning: boolean; open: boolean; progress?: number }) {
  return (
    <div className="relative grid place-items-center">
      {open ? (
        <span
          aria-hidden
          className="absolute size-16 rounded-full bg-primary/30 blur-lg"
          style={{ animation: "moat-unlock-glow 0.7s ease-out forwards" }}
        />
      ) : null}

      <MoatRing
        value={progress}
        size={72}
        thickness={5}
        ariaLabel={open ? "Unlocked" : "Moat is locked"}
      />

      {/* Orbiting accent — a slow ambient drift, fast while verifying. */}
      {!open ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ animation: `moat-orbit ${spinning ? "0.8s" : "9s"} linear infinite` }}
        >
          {/* Dot centre sits on the ring's stroke centreline: the 72px ring with
              5px stroke has its centreline 2.5px in, so a 6px dot starts at -0.5px. */}
          <span className="absolute top-[-0.5px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-clay" />
        </div>
      ) : null}

      {/* Lock glyph cross-fades from closed to open. */}
      <span
        aria-hidden
        className={cn(
          "absolute grid place-items-center transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100",
        )}
      >
        <IconLockFilled className="size-5 text-primary" />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute grid place-items-center transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <IconLockOpen className="size-5 text-primary" />
      </span>
    </div>
  );
}

function LockScreen({
  unlock,
  getUnlockLockoutMs,
  getAttemptsUntilLockout,
  getCurrentLockoutTotalMs,
  getPinLength,
  completeUnlock,
  hasPasskey,
  unlockWithPasskey,
  exiting,
}: {
  unlock: (pin: string) => Promise<boolean>;
  getUnlockLockoutMs: () => number;
  getAttemptsUntilLockout: () => number;
  getCurrentLockoutTotalMs: () => number;
  getPinLength: () => number | null;
  completeUnlock: () => void;
  hasPasskey: boolean;
  unlockWithPasskey: () => Promise<boolean>;
  exiting: boolean;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(() => getUnlockLockoutMs());
  const [pinLength] = useState(() => getPinLength());
  // Briefly reveal the digit just typed (phone-style), then mask it.
  const [revealedDigit, setRevealedDigit] = useState<string | null>(null);
  const revealTimer = useRef<number | null>(null);
  const autoPromptedBiometric = useRef(false);

  // Reveal animation state (driven once `exiting` flips true).
  const [markStyle, setMarkStyle] = useState<React.CSSProperties>();
  const [opened, setOpened] = useState(false);
  const [veilOut, setVeilOut] = useState(false);
  const markRef = useRef<HTMLDivElement>(null);

  const isThrottled = lockoutMs > 0;
  const targetLength = pinLength ?? MAX_PIN_LENGTH;
  const knownLength = pinLength != null;
  const disabled = isChecking || isThrottled || exiting;

  useEffect(() => {
    if (lockoutMs <= 0) return;
    const id = window.setInterval(() => setLockoutMs(getUnlockLockoutMs()), 1000);
    return () => window.clearInterval(id);
  }, [lockoutMs, getUnlockLockoutMs]);

  // The unlock reveal: glide the padlock to screen centre, open it, lift the
  // veil to show the app behind, then finish. Reduced-motion skips straight to
  // the finish. Contents behind are already mounted (status: unlocking).
  useEffect(() => {
    if (!exiting) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      completeUnlock();
      return;
    }
    let raf = 0;
    const el = markRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const dx = Math.round(window.innerWidth / 2 - (rect.left + rect.width / 2));
      const dy = Math.round(window.innerHeight / 2 - (rect.top + rect.height / 2));
      raf = window.requestAnimationFrame(() =>
        setMarkStyle({ transform: `translate(${dx}px, ${dy}px) scale(1.12)` }),
      );
    }
    const openAt = window.setTimeout(() => setOpened(true), 360);
    const veilAt = window.setTimeout(() => setVeilOut(true), 620);
    const doneAt = window.setTimeout(() => completeUnlock(), 1000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(openAt);
      window.clearTimeout(veilAt);
      window.clearTimeout(doneAt);
    };
  }, [exiting, completeUnlock]);

  const attemptUnlock = useCallback(
    async (candidate: string) => {
      if (candidate.length < MIN_PIN_LENGTH) return;
      setIsChecking(true);
      setError(null);

      const valid = await unlock(candidate);

      if (!valid) {
        const nextLockoutMs = getUnlockLockoutMs();
        const attemptsLeft = getAttemptsUntilLockout();
        setLockoutMs(nextLockoutMs);
        setError(
          nextLockoutMs > 0
            ? null
            : attemptsLeft > 0 && attemptsLeft <= 2
              ? `Incorrect PIN. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left before a temporary lock.`
              : "Incorrect PIN. Try again.",
        );
        setPin("");
        setShaking(true);
        vibrate([30, 60, 30]);
        window.setTimeout(() => setShaking(false), 420);
      }
      setIsChecking(false);
    },
    [unlock, getUnlockLockoutMs, getAttemptsUntilLockout],
  );

  const pushDigit = useCallback(
    (digit: string) => {
      if (isChecking || isThrottled || exiting) return;
      if (pin.length >= targetLength) return;
      const next = pin + digit;
      setError(null);
      vibrate(10);
      setPin(next);
      setRevealedDigit(digit);
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => setRevealedDigit(null), 300);
      if (knownLength && next.length === targetLength) {
        void attemptUnlock(next);
      }
    },
    [pin, isChecking, isThrottled, exiting, targetLength, knownLength, attemptUnlock],
  );

  const deleteDigit = useCallback(() => {
    if (isChecking || exiting) return;
    setError(null);
    setRevealedDigit(null);
    setPin((current) => current.slice(0, -1));
  }, [isChecking, exiting]);

  const clearAllDigits = useCallback(() => {
    if (isChecking || exiting) return;
    setError(null);
    setRevealedDigit(null);
    vibrate(20);
    setPin("");
  }, [isChecking, exiting]);

  const handleBiometric = useCallback(async () => {
    if (isBiometricChecking || isThrottled || exiting) return;
    setIsBiometricChecking(true);
    setError(null);
    const ok = await unlockWithPasskey();
    if (!ok) setError("Biometric unlock didn't work. Enter your PIN instead.");
    setIsBiometricChecking(false);
  }, [isBiometricChecking, isThrottled, exiting, unlockWithPasskey]);

  // Fire the biometric prompt as soon as the lock screen appears — once per
  // lock, never after a cancelled/failed attempt (the keypad is the fallback).
  // Deferred a beat so the screen paints before the OS sheet slides in.
  useEffect(() => {
    if (!hasPasskey || isThrottled || exiting || autoPromptedBiometric.current) return;
    const id = window.setTimeout(() => {
      if (autoPromptedBiometric.current) return;
      autoPromptedBiometric.current = true;
      void handleBiometric();
    }, 250);
    return () => window.clearTimeout(id);
  }, [hasPasskey, isThrottled, exiting, handleBiometric]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        pushDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        deleteDigit();
      } else if (event.key === "Enter" && !knownLength) {
        event.preventDefault();
        void attemptUnlock(pin);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pushDigit, deleteDigit, attemptUnlock, knownLength, pin]);

  const canManualSubmit = !knownLength && pin.length >= MIN_PIN_LENGTH && !disabled;
  const dotCount = knownLength ? targetLength : Math.max(pin.length, MIN_PIN_LENGTH);
  // Ring countdown: drain during a lockout and refill as the wait expires.
  const lockoutTotalMs = isThrottled ? getCurrentLockoutTotalMs() : 0;
  const ringProgress = lockoutTotalMs > 0 ? 1 - lockoutMs / lockoutTotalMs : 1;

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 flex flex-col items-center justify-center bg-background px-6 py-10",
        "transition-opacity duration-380 ease-out",
        veilOut && "pointer-events-none opacity-0",
      )}
    >
      <div
        className="flex w-full max-w-76 flex-col items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Live padlock — the one element that carries through to the reveal. */}
        <div
          ref={markRef}
          className="transition-transform duration-620"
          style={{ transitionTimingFunction: "cubic-bezier(0.2,0.85,0.25,1)", ...markStyle }}
        >
          <LockMark
            spinning={isChecking || (exiting && !opened)}
            open={opened}
            progress={ringProgress}
          />
        </div>

        {/* Everything below the padlock fades away as the reveal begins. */}
        <div
          className={cn(
            "flex w-full flex-col items-center transition-opacity duration-300",
            exiting && "pointer-events-none opacity-0",
          )}
        >
          <h1 className="mt-5 font-display text-xl font-semibold tracking-tight">Moat is locked</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasPasskey ? "Enter your PIN or use biometrics." : "Enter your PIN to continue."}
          </p>

          <div
            className={cn("mt-8 flex items-center justify-center gap-3", shaking && "animate-shake")}
            role="status"
            aria-label={`${pin.length} of ${knownLength ? targetLength : "several"} digits entered`}
          >
            {Array.from({ length: dotCount }).map((_, i) => {
              const isRevealed = revealedDigit != null && i === pin.length - 1;
              return isRevealed ? (
                <span
                  key={i}
                  className="grid size-3 place-items-center font-display text-sm font-semibold tabular-nums text-primary"
                >
                  {revealedDigit}
                </span>
              ) : (
                <span
                  key={i}
                  className={cn(
                    "size-3 rounded-full border transition-colors",
                    i < pin.length ? "border-primary bg-primary" : "border-input bg-transparent",
                  )}
                />
              );
            })}
          </div>

          <div className="mt-4 flex h-5 items-center justify-center text-center text-xs">
            {isThrottled ? (
              <span className="text-destructive" role="status">
                {formatLockoutMessage(lockoutMs)}
              </span>
            ) : error ? (
              <span className="text-destructive" role="alert">
                {error}
              </span>
            ) : isChecking ? (
              <span className="text-muted-foreground" role="status">
                Verifying…
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <Key key={digit} onPress={() => pushDigit(digit)} disabled={disabled}>
                {digit}
              </Key>
            ))}

            {hasPasskey ? (
              <Key
                onPress={() => void handleBiometric()}
                disabled={isThrottled || isBiometricChecking || exiting}
                variant="ghost"
                ariaLabel="Unlock with Face ID or fingerprint"
              >
                <IconFingerprint className="size-6" />
              </Key>
            ) : canManualSubmit ? (
              <Key onPress={() => void attemptUnlock(pin)} variant="ghost" ariaLabel="Unlock">
                <IconLockOpen className="size-6" />
              </Key>
            ) : (
              <span aria-hidden />
            )}

            <Key onPress={() => pushDigit("0")} disabled={disabled}>
              0
            </Key>

            {pin.length > 0 && !exiting ? (
              <Key
                onPress={deleteDigit}
                onLongPress={clearAllDigits}
                disabled={isChecking}
                variant="ghost"
                ariaLabel="Delete last digit (hold to clear all)"
              >
                <IconBackspace className="size-6" />
              </Key>
            ) : (
              <span aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const LONG_PRESS_MS = 550;

function Key({
  children,
  onPress,
  onLongPress,
  disabled,
  variant = "solid",
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  ariaLabel?: string;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function startLongPress() {
    if (!onLongPress) return;
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        // A completed long-press already acted; swallow the trailing click.
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onPress();
      }}
      onPointerDown={onLongPress ? startLongPress : undefined}
      onPointerUp={onLongPress ? cancelLongPress : undefined}
      onPointerLeave={onLongPress ? cancelLongPress : undefined}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid size-16 place-items-center rounded-full font-display text-2xl font-medium tabular-nums select-none",
        "transition-[background-color,transform] duration-100 active:scale-95",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "solid"
          ? "bg-muted/60 text-foreground hover:bg-muted active:bg-muted"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
