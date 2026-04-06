"use client";

import { useState } from "react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "idle" | "set" | "remove";

export function PinLockPanel() {
  const { hasPinLock, setPin, removePin, lock } = usePinLock();
  const [mode, setMode] = useState<Mode>("idle");
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

    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
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
      setSuccess("PIN lock enabled. You will be prompted for your PIN after 5 minutes of inactivity.");
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
    <Card className="border-border/30 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">PIN lock</CardTitle>
        <CardDescription>
          Protect the app with a PIN. Your PIN is derived using PBKDF2 and never stored in
          plain text. The session locks automatically after 5 minutes of inactivity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {success ? (
          <p className="text-xs text-muted-foreground">{success}</p>
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
            <div className="grid gap-2">
              <Label htmlFor="new-pin" className="text-xs">New PIN (minimum 4 digits)</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
                autoComplete="new-password"
                className="tracking-[0.3em]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-pin" className="text-xs">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Repeat PIN"
                autoComplete="new-password"
                className="tracking-[0.3em]"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isWorking}>
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
            <div className="grid gap-2">
              <Label htmlFor="current-pin" className="text-xs">Current PIN</Label>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter current PIN"
                autoComplete="current-password"
                className="tracking-[0.3em]"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="destructive" disabled={isWorking}>
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
