"use client";

import { useEffect, useRef, useState } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PinLockScreen() {
  const { unlock, getUnlockLockoutMs } = usePinLock();
  return <LockedPinScreen unlock={unlock} getUnlockLockoutMs={getUnlockLockoutMs} />;
}

function formatLockoutMessage(lockoutMs: number): string {
  const seconds = Math.ceil(lockoutMs / 1000);
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds}s.`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

function LockedPinScreen({
  unlock,
  getUnlockLockoutMs,
}: {
  unlock: (pin: string) => Promise<boolean>;
  getUnlockLockoutMs: () => number;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(() => getUnlockLockoutMs());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // While throttled, tick the countdown so the screen unlocks itself when
  // the lockout expires.
  useEffect(() => {
    if (lockoutMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLockoutMs(getUnlockLockoutMs());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [lockoutMs, getUnlockLockoutMs]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin) return;

    setIsChecking(true);
    setError(null);

    const valid = await unlock(pin);
    setIsChecking(false);

    if (!valid) {
      const nextLockoutMs = getUnlockLockoutMs();
      setLockoutMs(nextLockoutMs);
      setError(nextLockoutMs > 0 ? null : "Incorrect PIN. Try again.");
      setPin("");
      inputRef.current?.focus();
    }
  }

  const isThrottled = lockoutMs > 0;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/95 backdrop-blur">
      <Card className="w-full max-w-xs border-border/40 shadow-none">
        <CardContent className="px-6 py-8">
          <form className="grid gap-5" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-1 text-center">
              <div className="text-lg font-semibold tracking-tight">Moat is locked</div>
              <p className="text-sm text-muted-foreground">Enter your PIN to continue.</p>
            </div>

            {isThrottled ? (
              <p className="text-center text-xs text-destructive" role="status">
                {formatLockoutMessage(lockoutMs)}
              </p>
            ) : error ? (
              <p className="text-center text-xs text-destructive">{error}</p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="pin-input" className="sr-only">
                PIN
              </Label>
              <Input
                id="pin-input"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter PIN"
                autoComplete="current-password"
                className="text-center tracking-[0.3em]"
                disabled={isThrottled}
              />
            </div>

            <Button
              type="submit"
              disabled={isChecking || isThrottled || pin.length < MIN_PIN_LENGTH}
              className="w-full"
            >
              {isChecking ? "Checking..." : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
