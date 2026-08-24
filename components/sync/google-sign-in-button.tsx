"use client";

import { useState } from "react";

import { startGoogleSignIn } from "@/lib/sync/pkce";
import { rememberSignInAttempt } from "@/lib/sync/sign-in-handoff";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  endpoint,
  userId,
  existingAuthToken,
  disabled,
}: {
  endpoint: string;
  userId: string;
  existingAuthToken?: string;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();

  async function start() {
    if (!clientId) {
      setError("No Google client id is configured for this deployment.");
      return;
    }
    if (!endpoint.trim()) {
      setError("Set the sync endpoint first, so this device knows where to sign in.");
      return;
    }

    setIsStarting(true);
    setError(null);

    const redirectUri = `${window.location.origin}/auth/callback`;
    const attempt = await startGoogleSignIn({ clientId, redirectUri });

    // The ledger already on this device is offered, and the token it already
    // holds goes with it as proof that the ledger is this device's to offer.
    rememberSignInAttempt({
      verifier: attempt.verifier,
      nonce: attempt.nonce,
      state: attempt.state,
      redirectUri,
      endpoint: endpoint.trim(),
      proposedUserId: userId,
      existingAuthToken: existingAuthToken?.trim() || undefined,
    });

    window.location.assign(attempt.authorizeUrl);
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={disabled || isStarting}
        onClick={() => void start()}
      >
        {isStarting ? "Opening Google…" : "Sign in with Google"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Links this device&apos;s ledger to your Google account and gets its own sync token. Your
        records stay sealed; signing in does not move the key that opens them.
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
