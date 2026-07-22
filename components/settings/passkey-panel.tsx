"use client";

import { useEffect, useState } from "react";
import { IconFingerprint } from "@tabler/icons-react";

import { usePinLock } from "@/lib/security/pin-lock-context";
import { isPlatformAuthenticatorAvailable } from "@/lib/security/passkey";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PasskeyPanel() {
  const { hasPinLock, lockState, hasPasskey, enablePasskey, removePasskey } = usePinLock();
  const [available, setAvailable] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isPlatformAuthenticatorAvailable().then((result) => {
      if (!cancelled) setAvailable(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to offer if the device has no biometric authenticator.
  if (!available) {
    return null;
  }

  async function handleEnable() {
    setIsWorking(true);
    setError(null);
    setMessage(null);
    const result = await enablePasskey();
    setIsWorking(false);
    if (result.ok) {
      setMessage("Biometric unlock is on. You can unlock with Face ID or your fingerprint.");
    } else {
      setError(result.error ?? "Could not set up biometric unlock.");
    }
  }

  function handleRemove() {
    removePasskey();
    setMessage(null);
    setError(null);
  }

  return (
    <Card>
      <CardContent className="grid gap-3 px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
          >
            <IconFingerprint className="size-4.5" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Biometric unlock</p>
            <p className="text-xs text-muted-foreground">
              Unlock with Face ID or your fingerprint. Your PIN keeps working as a backup, so you
              can still get in if biometrics ever fail.
            </p>
          </div>
        </div>

        {!hasPinLock ? (
          <p className="text-xs text-muted-foreground">Set a PIN first to enable biometric unlock.</p>
        ) : hasPasskey ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-pos">On</span>
            <Button size="sm" variant="outline" onClick={handleRemove}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={isWorking || lockState.status !== "unlocked"}
            onClick={() => void handleEnable()}
          >
            {isWorking ? "Setting up…" : "Set up biometric unlock"}
          </Button>
        )}

        {lockState.status !== "unlocked" && hasPinLock && !hasPasskey ? (
          <p className="text-xs text-muted-foreground">Unlock Moat to set this up.</p>
        ) : null}
        {message ? <p className="text-xs text-pos">{message}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
