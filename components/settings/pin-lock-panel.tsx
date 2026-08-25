"use client";

import { useState } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import {
  MIN_PIN_LENGTH,
  PIN_REQUIREMENT_MESSAGE,
  isValidPin,
} from "@/lib/security/pin-policy";
import {
  LOCK_TIMEOUT_CHOICES,
  describeLockTimeout,
  isLockTimeout,
  readLockTimeout,
  writeLockTimeout,
  type LockTimeoutMinutes,
} from "@/lib/preferences/lock-timeout";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PinInputField } from "@/components/forms/pin-input-field";

type Mode = "idle" | "set" | "remove";

export function PinLockPanel() {
  const { hasPinLock, setPin, removePin, lock } = usePinLock();
  const [mode, setMode] = useState<Mode>("idle");
  const [lockTimeout, setLockTimeout] = useState<LockTimeoutMinutes>(readLockTimeout);
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function resetForm() {
    setPinValue("");
    setConfirmPin("");
    setCurrentPin("");
    setError(null);
    setSuccess(null);
    setMode("idle");
  }

  async function handleSetPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidPin(pin)) {
      setError(PIN_REQUIREMENT_MESSAGE);
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setIsWorking(true);
    const ok = await setPin(pin);
    setIsWorking(false);

    if (ok) {
      setSuccess("PIN lock is on.");
      resetForm();
    } else {
      setError("Failed to set PIN. Please try again.");
    }
  }

  async function handleRemovePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsWorking(true);

    const ok = await removePin(currentPin);
    setIsWorking(false);

    if (ok) {
      setSuccess("PIN lock removed.");
      resetForm();
    } else {
      setError("Incorrect PIN.");
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">PIN lock</CardTitle>
        <CardDescription>
          Encrypts your records and locks the app when it sits idle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasPinLock ? (
          <p className="text-xs text-foreground">
            No PIN set. Records are stored unencrypted.
          </p>
        ) : null}
        {success ? (
          <p className="text-xs text-muted-foreground">{success}</p>
        ) : null}

        {mode === "idle" && hasPinLock ? (
          <div className="grid max-w-xs gap-1">
            <Label htmlFor="lock-timeout">Lock when idle</Label>
            <select
              id="lock-timeout"
              value={lockTimeout}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!isLockTimeout(next)) return;
                setLockTimeout(next);
                writeLockTimeout(next);
                setSuccess(`Moat will lock ${describeLockTimeout(next).toLowerCase()}.`);
              }}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm"
            >
              {LOCK_TIMEOUT_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {describeLockTimeout(choice)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {mode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            {hasPinLock ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setMode("set"); setSuccess(null); }}
                >
                  Change PIN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setMode("remove"); setSuccess(null); }}
                >
                  Remove PIN lock
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={lock}
                >
                  Lock now
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setMode("set"); setSuccess(null); }}
              >
                Enable PIN lock
              </Button>
            )}
          </div>
        ) : null}

        {mode === "set" ? (
          <form className="grid gap-4" onSubmit={(e) => void handleSetPin(e)}>
            <PinInputField
              id="new-pin"
              label={`New PIN (minimum ${MIN_PIN_LENGTH} digits)`}
              value={pin}
              onChange={setPinValue}
              placeholder={`at least ${MIN_PIN_LENGTH} digits`}
              autoComplete="new-password"
            />
            <PinInputField
              id="confirm-pin"
              label="Confirm PIN"
              value={confirmPin}
              onChange={setConfirmPin}
              placeholder="Repeat PIN"
              autoComplete="new-password"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isWorking}>
                {isWorking ? "Setting PIN..." : "Set PIN"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "remove" ? (
          <form className="grid gap-4" onSubmit={(e) => void handleRemovePin(e)}>
            <p className="text-xs text-muted-foreground">
              Removing the PIN also decrypts your records on this device. They stay
              readable to anything that can read this browser&apos;s storage until you set
              a PIN again.
            </p>
            <PinInputField
              id="current-pin"
              label="Current PIN"
              value={currentPin}
              onChange={setCurrentPin}
              placeholder="Enter current PIN"
              autoComplete="current-password"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={isWorking}>
                {isWorking ? "Removing..." : "Remove PIN lock"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
