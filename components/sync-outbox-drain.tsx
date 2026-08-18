"use client";

import { useCallback, useEffect, useRef } from "react";

import { repositories } from "@/lib/repositories/instance";
import { runHostedSync } from "@/lib/sync/engine";

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
