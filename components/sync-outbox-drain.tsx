"use client";

import { useCallback, useEffect, useRef } from "react";

import { repositories } from "@/lib/repositories/instance";
import { runHostedSync } from "@/lib/sync/engine";

/**
 * Drains the sync outbox wherever the user happens to be.
 *
 * Captures already succeed offline — they are written straight to IndexedDB —
 * so the gap was never capture, it was delivery: the outbox only drained on the
 * settings screen, which is the one screen nobody visits after setup. A capture
 * made on a bus could sit unsent for days.
 *
 * True background delivery would need the key hierarchy inside the service
 * worker, so this runs on the events that actually precede a successful send:
 * regaining connectivity, and returning to the app.
 */
export function SyncOutboxDrain() {
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    running.current = true;
    try {
      const profile = await repositories.userProfile.get();
      if (!profile) return;

      const syncProfile = await repositories.syncProfiles.getByUser(profile.id);
      if (!syncProfile?.hostedSyncEnabled || syncProfile.mode !== "hosted_opt_in") return;

      const outbox = await repositories.syncOutbox.listByUser(profile.id);
      const hasWork = outbox.some(
        (item) => item.status === "pending" || item.status === "failed",
      );
      if (!hasWork) return;

      await runHostedSync({ repositories, profile: syncProfile, isOnline: true });
    } catch {
      // A failed drain is not worth interrupting the user for. The items stay
      // in the outbox and the next trigger tries again.
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    void drain();

    function onVisible() {
      if (document.visibilityState === "visible") void drain();
    }

    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [drain]);

  return null;
}
