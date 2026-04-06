"use client";

import { useCallback, useEffect, useState } from "react";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { SyncMode, SyncProfile, SyncOutboxItem, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField } from "@/components/forms/input-field";

const repositories = createIndexedDbRepositories();

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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function SyncModePanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [syncProfile, setSyncProfile] = useState<SyncProfile | null>(null);
  const [pendingItems, setPendingItems] = useState<SyncOutboxItem[]>([]);
  const [postgresSyncUrl, setPostgresSyncUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      repositories.syncOutbox.listPendingByUser(user.id),
    ]);

    const nextProfile = storedSyncProfile ?? createDefaultSyncProfile(user);
    setSyncProfile(nextProfile);
    setPostgresSyncUrl(nextProfile.postgresSyncUrl ?? "");
    setPendingItems(outbox);
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
                    updatedAt: timestamp,
                  });
                }}
              >
                Save hosted sync settings
              </Button>
              <div className="text-xs text-muted-foreground">
                Pending local changes: {pendingItems.length}
              </div>
            </div>
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
