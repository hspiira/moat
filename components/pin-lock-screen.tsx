"use client";

import { useEffect, useRef, useState } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PinLockScreen() {
  const { lockState, unlock } = usePinLock();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lockState.status === "locked") {
      setPin("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [lockState.status]);

  if (lockState.status !== "locked") {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin) return;

    setIsChecking(true);
    setError(null);

    const valid = await unlock(pin);
    setIsChecking(false);

    if (!valid) {
      setError("Incorrect PIN. Try again.");
      setPin("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur">
      <Card className="w-full max-w-xs border-border/40 shadow-none">
        <CardContent className="px-6 py-8">
          <form className="grid gap-5" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-1 text-center">
              <div className="text-lg font-semibold tracking-tight">Moat is locked</div>
              <p className="text-sm text-muted-foreground">Enter your PIN to continue.</p>
            </div>

            {error ? (
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
              />
            </div>

            <Button type="submit" disabled={isChecking || pin.length < 4} className="w-full">
              {isChecking ? "Checking..." : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
