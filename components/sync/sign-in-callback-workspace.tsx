"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import { readSignInRedirect } from "@/lib/sync/pkce";
import { completeGoogleSignIn } from "@/lib/sync/sign-in";
import { matchesAttempt, takeSignInAttempt } from "@/lib/sync/sign-in-handoff";
import { Button } from "@/components/ui/button";

type Outcome =
  | { state: "working" }
  | { state: "done"; isNewUser: boolean }
  | { state: "refused"; message: string; nextStep?: string };

export function SignInCallbackWorkspace() {
  const [outcome, setOutcome] = useState<Outcome>({ state: "working" });
  // The attempt can only be read once, so a second run would find nothing and
  // report a failure that never happened.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const attempt = takeSignInAttempt();
      const redirect = readSignInRedirect(window.location.search);

      if ("error" in redirect) {
        setOutcome({ state: "refused", message: redirect.error });
        return;
      }

      if (!matchesAttempt(attempt, redirect.state)) {
        setOutcome({
          state: "refused",
          message: "This sign-in did not start on this device. Start again from Settings.",
        });
        return;
      }

      const result = await completeGoogleSignIn({
        endpoint: attempt!.endpoint,
        code: redirect.code,
        codeVerifier: attempt!.verifier,
        redirectUri: attempt!.redirectUri,
        nonce: attempt!.nonce,
        proposedUserId: attempt!.proposedUserId,
        existingAuthToken: attempt!.existingAuthToken,
      });

      if (result.status === "refused") {
        setOutcome({ state: "refused", message: result.message, nextStep: result.nextStep });
        return;
      }

      const profile = await repositories.syncProfiles.getByUser(result.userId);
      const timestamp = new Date().toISOString();

      // Anything already on the profile is kept, then the sign-in's own answers
      // are written over it. The other order would discard the token just minted.
      await repositories.syncProfiles.save({
        ...profile,
        id: profile?.id ?? `sync-profile:${result.userId}`,
        userId: result.userId,
        mode: "hosted_opt_in",
        hostedSyncEnabled: true,
        postgresSyncUrl: attempt!.endpoint,
        syncAuthToken: result.syncAuthToken,
        createdAt: profile?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      setOutcome({ state: "done", isNewUser: result.isNewUser });
    })();
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4 py-8">
      {outcome.state === "working" ? (
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      ) : null}

      {outcome.state === "done" ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {outcome.isNewUser ? "Account created" : "Signed in"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {outcome.isNewUser
              ? "This device now syncs. Records leave it sealed, and only your key opens them."
              : "This device is linked to your account. What is already here stays here."}
          </p>
          <Button asChild className="justify-self-start">
            <Link href="/settings">Back to settings</Link>
          </Button>
        </>
      ) : null}

      {outcome.state === "refused" ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Sign-in did not finish
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">{outcome.message}</p>
          {outcome.nextStep ? (
            <p className="text-sm leading-6 text-foreground">{outcome.nextStep}</p>
          ) : null}
          <p className="text-sm leading-6 text-muted-foreground">
            Nothing on this device has changed. Your records are where they were.
          </p>
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/settings">Back to settings</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
