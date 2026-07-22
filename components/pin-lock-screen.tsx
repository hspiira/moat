"use client";

import { useCallback, useEffect, useState } from "react";
import { IconArrowRight, IconBackspace, IconFingerprint, IconLockFilled } from "@tabler/icons-react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";
import { MoatRing } from "@/components/moat/moat-ring";
import { cn } from "@/lib/utils";

export function PinLockScreen() {
  const { unlock, getUnlockLockoutMs, getPinLength, hasPasskey, unlockWithPasskey } = usePinLock();
  return (
    <LockScreen
      unlock={unlock}
      getUnlockLockoutMs={getUnlockLockoutMs}
      getPinLength={getPinLength}
      hasPasskey={hasPasskey}
      unlockWithPasskey={unlockWithPasskey}
    />
  );
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

function LockScreen({
  unlock,
  getUnlockLockoutMs,
  getPinLength,
  hasPasskey,
  unlockWithPasskey,
}: {
  unlock: (pin: string) => Promise<boolean>;
  getUnlockLockoutMs: () => number;
  getPinLength: () => number | null;
  hasPasskey: boolean;
  unlockWithPasskey: () => Promise<boolean>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(() => getUnlockLockoutMs());
  // The saved PIN's length lets us show fixed dots and auto-submit the instant
  // the last digit lands. Null (older material) falls back to a submit arrow.
  const [pinLength] = useState(() => getPinLength());

  const isThrottled = lockoutMs > 0;
  const targetLength = pinLength ?? MAX_PIN_LENGTH;
  const knownLength = pinLength != null;

  // Tick down the throttle countdown so the screen frees itself when it expires.
  useEffect(() => {
    if (lockoutMs <= 0) return;
    const id = window.setInterval(() => setLockoutMs(getUnlockLockoutMs()), 1000);
    return () => window.clearInterval(id);
  }, [lockoutMs, getUnlockLockoutMs]);

  const attemptUnlock = useCallback(
    async (candidate: string) => {
      if (candidate.length < MIN_PIN_LENGTH) return;

      setIsChecking(true);
      setError(null);

      const valid = await unlock(candidate);

      if (!valid) {
        const nextLockoutMs = getUnlockLockoutMs();
        setLockoutMs(nextLockoutMs);
        setError(nextLockoutMs > 0 ? null : "Incorrect PIN. Try again.");
        setPin("");
        setShaking(true);
        window.setTimeout(() => setShaking(false), 420);
      }
      setIsChecking(false);
    },
    [unlock, getUnlockLockoutMs],
  );

  const pushDigit = useCallback(
    (digit: string) => {
      if (isChecking || isThrottled) return;
      setError(null);
      setPin((current) => {
        if (current.length >= targetLength) return current;
        const next = current + digit;
        if (knownLength && next.length === targetLength) {
          void attemptUnlock(next);
        }
        return next;
      });
    },
    [isChecking, isThrottled, targetLength, knownLength, attemptUnlock],
  );

  const deleteDigit = useCallback(() => {
    if (isChecking) return;
    setError(null);
    setPin((current) => current.slice(0, -1));
  }, [isChecking]);

  const handleBiometric = useCallback(async () => {
    if (isBiometricChecking || isThrottled) return;
    setIsBiometricChecking(true);
    setError(null);
    const ok = await unlockWithPasskey();
    if (!ok) setError("Biometric unlock didn't work. Enter your PIN instead.");
    setIsBiometricChecking(false);
  }, [isBiometricChecking, isThrottled, unlockWithPasskey]);

  // Hardware keyboard support (desktop): digits, backspace, enter.
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

  const canManualSubmit = !knownLength && pin.length >= MIN_PIN_LENGTH && !isChecking && !isThrottled;
  const dotCount = knownLength ? targetLength : Math.max(pin.length, MIN_PIN_LENGTH);

  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background px-6 py-10">
      <div
        className="flex w-full max-w-76 flex-col items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Brand: a closed moat ring with a lock — the moat is complete. */}
        <MoatRing
          value={1}
          size={72}
          thickness={5}
          ariaLabel="Moat is locked"
          label={<IconLockFilled className="size-5 text-primary" aria-hidden />}
        />

        <h1 className="mt-5 font-display text-xl font-semibold tracking-tight">Moat is locked</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasPasskey ? "Enter your PIN or use biometrics." : "Enter your PIN to continue."}
        </p>

        {/* PIN progress dots */}
        <div
          className={cn("mt-8 flex items-center justify-center gap-3", shaking && "animate-shake")}
          role="status"
          aria-label={`${pin.length} of ${knownLength ? targetLength : "several"} digits entered`}
        >
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-3 rounded-full border transition-colors",
                i < pin.length ? "border-primary bg-primary" : "border-input bg-transparent",
              )}
            />
          ))}
        </div>

        {/* Status line — fixed height so the keypad never jumps. */}
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
            <span className="text-muted-foreground">Checking…</span>
          ) : null}
        </div>

        {/* Keypad */}
        <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <Key key={digit} onPress={() => pushDigit(digit)} disabled={isThrottled || isChecking}>
              {digit}
            </Key>
          ))}

          {/* Bottom-left: biometric, or a submit arrow when the length is unknown. */}
          {hasPasskey ? (
            <Key
              onPress={() => void handleBiometric()}
              disabled={isThrottled || isBiometricChecking}
              variant="ghost"
              ariaLabel="Unlock with Face ID or fingerprint"
            >
              <IconFingerprint className="size-6" />
            </Key>
          ) : canManualSubmit ? (
            <Key
              onPress={() => void attemptUnlock(pin)}
              variant="ghost"
              ariaLabel="Unlock"
            >
              <IconArrowRight className="size-6" />
            </Key>
          ) : (
            <span aria-hidden />
          )}

          <Key onPress={() => pushDigit("0")} disabled={isThrottled || isChecking}>
            0
          </Key>

          {/* Bottom-right: backspace. */}
          {pin.length > 0 ? (
            <Key onPress={deleteDigit} disabled={isChecking} variant="ghost" ariaLabel="Delete last digit">
              <IconBackspace className="size-6" />
            </Key>
          ) : (
            <span aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

function Key({
  children,
  onPress,
  disabled,
  variant = "solid",
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
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
