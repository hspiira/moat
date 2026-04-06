"use client";

import { useCallback, useEffect, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import type { SyncMode, SyncProfile, SyncOutboxItem, UserProfile } from "@/lib/types";
import { runHostedSync } from "@/lib/sync/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField } from "@/components/forms/input-field";


const syncModeOptions: { value: SyncMode; label: string; body: string }[] = [
  {
    value: "local_only",
    label: "Local only",
    body: "Keep all records on this device. No hosted sync is attempted.",
  },
  {
    value: "hosted_opt_in",
    label: "Hosted sync",
    body: "Keep using local storage offline, then queue changes for later sync to Postgres when enabled.",
  },
];

function createDefaultSyncProfile(user: UserProfile): SyncProfile {
  const timestamp = new Date().toISOString();
  return {
    id: `sync-profile:${user.id}`,
    userId: user.id,
    mode: "local_only",
    hostedSyncEnabled: false,
    deviceId: `device:${crypto.randomUUID()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function SyncModePanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [syncProfile, setSyncProfile] = useState<SyncProfile | null>(null);
  const [pendingItems, setPendingItems] = useState<SyncOutboxItem[]>([]);
  const [conflictItems, setConflictItems] = useState<SyncOutboxItem[]>([]);
  const [postgresSyncUrl, setPostgresSyncUrl] = useState("");
  const [syncAuthToken, setSyncAuthToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const loadState = useCallback(async () => {
    const user = await repositories.userProfile.get();
    setProfile(user);

    if (!user) {
      setSyncProfile(null);
      setPendingItems([]);
      return;
    }

    const [storedSyncProfile, outbox] = await Promise.all([
      repositories.syncProfiles.getByUser(user.id),
      repositories.syncOutbox.listByUser(user.id),
    ]);

    const nextProfile = storedSyncProfile ?? createDefaultSyncProfile(user);
    setSyncProfile(nextProfile);
    setPostgresSyncUrl(nextProfile.postgresSyncUrl ?? "");
    setSyncAuthToken(nextProfile.syncAuthToken ?? "");
    setPendingItems(outbox.filter((item) => item.status === "pending" || item.status === "failed"));
    setConflictItems(outbox.filter((item) => item.status === "conflict"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function saveSyncProfile(next: SyncProfile) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await repositories.syncProfiles.save(next);
      setSyncProfile(next);
      setSuccess("Sync preference saved locally.");
      await loadState();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save sync preference.");
    } finally {
      setIsSaving(false);
    }
  }

  const syncNow = useCallback(
    async (activeProfile: SyncProfile) => {
      setIsSyncing(true);
      setError(null);
      setSuccess(null);

      try {
        const summary = await runHostedSync({
          repositories,
          profile: activeProfile,
          isOnline,
        });

        if (summary.error) {
          setError(summary.error);
        } else {
          setSuccess(
            summary.attempted === 0
              ? "Nothing to sync right now."
              : `Sync complete. ${summary.synced} synced, ${summary.failed} failed, ${summary.conflicts} conflict${summary.conflicts === 1 ? "" : "s"}.`,
          );
        }
        await loadState();
      } finally {
        setIsSyncing(false);
      }
    },
    [isOnline, loadState],
  );

  useEffect(() => {
    if (!syncProfile || !isOnline) return;
    if (!syncProfile.hostedSyncEnabled || syncProfile.mode !== "hosted_opt_in") return;
    if (pendingItems.length === 0) return;

    void syncNow(syncProfile);
  }, [isOnline, pendingItems.length, syncNow, syncProfile]);

  if (!profile || !syncProfile) {
    return (
      <Card className="border-border/20 shadow-none">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Finish onboarding before configuring storage and sync.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/20 shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Offline-first storage</div>
          <div className="text-sm text-muted-foreground">
            Moat always writes locally first. Hosted sync is optional and only replays queued local
            changes for users who opt in.
          </div>
        </div>

        <div className="grid gap-2">
          {syncModeOptions.map((option) => {
            const active = syncProfile.mode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const timestamp = new Date().toISOString();
                  void saveSyncProfile({
                    ...syncProfile,
                    mode: option.value,
                    hostedSyncEnabled: option.value === "hosted_opt_in",
                    postgresSyncUrl:
                      option.value === "hosted_opt_in" ? postgresSyncUrl.trim() || undefined : undefined,
                    syncAuthToken:
                      option.value === "hosted_opt_in" ? syncAuthToken.trim() || undefined : undefined,
                    updatedAt: timestamp,
                  });
                }}
                className={`grid gap-1 border px-3 py-3 text-left ${
                  active ? "border-primary dark:border-cyan-300" : "border-border/20"
                }`}
              >
                <div className="text-sm text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.body}</div>
              </button>
            );
          })}
        </div>

        {syncProfile.mode === "hosted_opt_in" ? (
          <div className="grid gap-3">
            <InputField
              id="postgres-sync-url"
              label="Sync endpoint"
              value={postgresSyncUrl}
              onChange={(event) => setPostgresSyncUrl(event.target.value)}
              placeholder="https://sync.example.com"
              autoComplete="off"
              hint="Optional today. Local writes continue even if this is unreachable."
            />
            <InputField
              id="sync-auth-token"
              label="Sync bearer token"
              value={syncAuthToken}
              onChange={(event) => setSyncAuthToken(event.target.value)}
              placeholder="Optional bearer token"
              autoComplete="off"
              hint="Only needed when the hosted sync backend requires authentication."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={() => {
                  const timestamp = new Date().toISOString();
                  void saveSyncProfile({
                    ...syncProfile,
                    hostedSyncEnabled: true,
                    mode: "hosted_opt_in",
                    postgresSyncUrl: postgresSyncUrl.trim() || undefined,
                    syncAuthToken: syncAuthToken.trim() || undefined,
                    updatedAt: timestamp,
                  });
                }}
              >
                Save hosted sync settings
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSyncing || isSaving}
                onClick={() => void syncNow(syncProfile)}
              >
                {isSyncing ? "Syncing..." : "Sync now"}
              </Button>
              <div className="text-xs text-muted-foreground">
                Pending local changes: {pendingItems.length}
              </div>
              <div className="text-xs text-muted-foreground">
                Conflicts requiring review: {conflictItems.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {isOnline ? "Online" : "Offline"}
                {syncProfile.lastSyncedAt ? ` · Last synced ${syncProfile.lastSyncedAt}` : ""}
              </div>
            </div>
            {conflictItems.length > 0 ? (
              <div className="grid gap-2 border border-destructive/20 p-3 text-xs">
                <div className="text-foreground">Hosted sync conflicts</div>
                {conflictItems.map((item) => (
                  <div key={item.id} className="text-muted-foreground">
                    {item.entityType}:{item.entityId}
                    {item.lastError ? ` · ${item.lastError}` : ""}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Local-only mode is active. No remote sync is attempted.
          </div>
        )}

        {success ? <div className="text-xs text-muted-foreground">{success}</div> : null}
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
      </CardContent>
    </Card>
  );
}
