"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import type { SyncMode, SyncProfile, SyncOutboxItem, UserProfile } from "@/lib/types";
import { runHostedSync } from "@/lib/sync/engine";
import { backfillSyncOutbox, hasBackfilled } from "@/lib/sync/backfill";
import { migrateIdsToCuid2 } from "@/lib/app-state/id-migration";
import { readGoogleDriveBackupPreferences } from "@/lib/preferences/google-drive-backup";
import { isHostedSyncEnabled } from "@/lib/features";
import { GoogleSignInButton } from "@/components/sync/google-sign-in-button";
import { needsManualSyncEndpoint, resolveSyncEndpoint } from "@/lib/sync/endpoint";
import { isKnownOffline } from "@/lib/sync/connectivity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField } from "@/components/forms/input-field";
import { createId } from "@/lib/ids";
import { syncProfileId } from "@/lib/domain/seeded-ids";

const syncModeOptions: { value: SyncMode; label: string; body: string }[] = [
  {
    value: "local_only",
    label: "Local only",
    body: "Keep all records on this device. No hosted sync is attempted.",
  },
  {
    value: "hosted_opt_in",
    label: "Hosted sync",
    body: "Keep working offline; your changes are queued and sent to the cloud when a connection is available.",
  },
];

function createDefaultSyncProfile(user: UserProfile): SyncProfile {
  const timestamp = new Date().toISOString();
  return {
    id: syncProfileId(user.id),
    userId: user.id,
    mode: "local_only",
    hostedSyncEnabled: false,
    deviceId: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function SyncModePanel() {
  const hostedSyncEnabled = isHostedSyncEnabled();
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
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

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
    setIsOnline(!isKnownOffline());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(!isKnownOffline());

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
    const previous = syncProfile;

    try {
      await repositories.syncProfiles.save(next);
      setSyncProfile(next);
      setSuccess("Sync preference saved locally.");

      if (next.hostedSyncEnabled && next.mode === "hosted_opt_in" && !hasBackfilled(next)) {
        const backupTakenAt = readGoogleDriveBackupPreferences().lastBackupAt ?? null;

        const rehearsal = await migrateIdsToCuid2({
          repositories,
          userId: next.userId,
          backupTakenAt,
          dryRun: true,
        });
        setBackfillStatus(
          rehearsal.recordsRewritten > 0
            ? `Preparing your records... ${rehearsal.recordsRewritten} to renumber.`
            : "Preparing your records...",
        );

        const migration = await migrateIdsToCuid2({
          repositories,
          userId: next.userId,
          backupTakenAt,
        });

        if (migration.blocked) {
          if (previous) {
            await repositories.syncProfiles.save(previous);
            setSyncProfile(previous);
          }
          setBackfillStatus(null);
          setSuccess(null);
          setError(migration.reason ?? "Sync could not be switched on.");
          return;
        }

        const migratedUser = await repositories.userProfile.get();
        const activeProfile = migratedUser
          ? ((await repositories.syncProfiles.getByUser(migratedUser.id)) ?? {
              ...next,
              userId: migratedUser.id,
            })
          : next;

        const summary = await backfillSyncOutbox({
          repositories,
          profile: activeProfile,
          onProgress: (progress) =>
            setBackfillStatus(
              `Preparing your existing records... ${progress.queued} queued (${progress.storesDone}/${progress.storesTotal})`,
            ),
        });
        setBackfillStatus(
          summary.queued > 0
            ? `${summary.queued} existing record${summary.queued === 1 ? "" : "s"} queued to upload.`
            : null,
        );
      }

      await loadState();
    } catch (saveError) {
      setBackfillStatus(null);
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
      <Card className="shadow-none">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Finish setting up before managing storage.
        </CardContent>
      </Card>
    );
  }

  if (!hostedSyncEnabled) {
    return (
      <Card className="shadow-none">
        <CardContent className="grid gap-1 p-5">
          <div className="text-sm text-foreground">Everything stays on this device</div>
          <div className="text-sm text-muted-foreground">
            Your data is saved on this device only. To move it to another device, use an encrypted
            backup below.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Storage and sync</div>
          <div className="text-sm text-muted-foreground">
            Saved on this device first. Sync is optional.
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
                      option.value === "hosted_opt_in"
                        ? resolveSyncEndpoint(postgresSyncUrl) || undefined
                        : undefined,
                    syncAuthToken:
                      option.value === "hosted_opt_in" ? syncAuthToken.trim() || undefined : undefined,
                    updatedAt: timestamp,
                  });
                }}
                className={`grid gap-1 border px-3 py-3 text-left ${
                  active ? "border-primary" : ""
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
            {needsManualSyncEndpoint() ? (
              <InputField
                id="postgres-sync-url"
                label="Sync endpoint"
                value={postgresSyncUrl}
                onChange={(event) => setPostgresSyncUrl(event.target.value)}
                placeholder="https://sync.example.com"
                autoComplete="off"
                hint="This build was not given a sync server, so it needs one here."
              />
            ) : null}
            <GoogleSignInButton
              endpoint={resolveSyncEndpoint(postgresSyncUrl)}
              userId={profile.id}
              existingAuthToken={syncAuthToken}
              disabled={isSaving}
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
                    postgresSyncUrl: resolveSyncEndpoint(postgresSyncUrl) || undefined,
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
              <div className="grid gap-3 border border-destructive/20 p-3 text-xs">
                <div className="grid gap-1">
                  <div className="text-foreground">Hosted sync conflicts</div>
                  <div className="text-muted-foreground">
                    {conflictItems.length} item{conflictItems.length === 1 ? "" : "s"} need a final choice before hosted sync can continue cleanly.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings/sync-conflicts">Review conflicts</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Local-only mode is active. No remote sync is attempted.
          </div>
        )}

        {backfillStatus ? (
          <div className="text-xs text-muted-foreground">{backfillStatus}</div>
        ) : null}
        {success ? <div className="text-xs text-muted-foreground">{success}</div> : null}
        {error ? <div className="text-xs text-destructive">{error}</div> : null}
      </CardContent>
    </Card>
  );
}
