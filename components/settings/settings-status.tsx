"use client";

import { useEffect, useState } from "react";
import { IconCloudLock, IconDeviceFloppy } from "@tabler/icons-react";

import { readBackupStaleness, type BackupStaleness } from "@/lib/domain/backup-staleness";
import { readGoogleDriveBackupPreferences } from "@/lib/preferences/google-drive-backup";
import { repositories } from "@/lib/repositories/instance";
import type { SyncMode } from "@/lib/types";

function describeBackup(staleness: BackupStaleness | null): string {
  if (staleness === null) return "Checking…";
  if (staleness.state === "never") return "No backup taken yet";
  if (staleness.days === 0) return "Backed up today";
  if (staleness.days === 1) return "Backed up yesterday";
  return `Backed up ${staleness.days} days ago`;
}

function describeStorage(mode: SyncMode | null): string {
  if (mode === null) return "Checking…";
  return mode === "hosted_opt_in" ? "Syncing to the cloud" : "On this device only";
}

// The two facts worth knowing before you open anything: where the records
// live, and how long since you took a copy. They open the page that changes
// each of them.
export function SettingsStatus() {
  const [mode, setMode] = useState<SyncMode | null>(null);
  const [staleness, setStaleness] = useState<BackupStaleness | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const preferences = readGoogleDriveBackupPreferences();
      const backup = readBackupStaleness(preferences.lastBackupAt);

      let syncMode: SyncMode = "local_only";
      try {
        const user = await repositories.userProfile.get();
        if (user) {
          const syncProfile = await repositories.syncProfiles.getByUser(user.id);
          syncMode = syncProfile?.mode ?? "local_only";
        }
      } catch {
        // A settings summary is not worth failing the page over; the panels
        // themselves report properly when they cannot read.
      }

      if (!cancelled) {
        setStaleness(backup);
        setMode(syncMode);
      }
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  const isStale = staleness?.state === "never" || staleness?.state === "stale";

  // A dl may group a dt and dd in a div, but only one level deep, so the icon
  // rides in the term rather than in a wrapper around both.
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <IconCloudLock aria-hidden className="size-3.5 shrink-0" />
          Storage
        </dt>
        <dd className="mt-0.5 text-sm font-medium text-foreground">{describeStorage(mode)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <IconDeviceFloppy aria-hidden className="size-3.5 shrink-0" />
          Backup
        </dt>
        <dd className={`mt-0.5 text-sm font-medium ${isStale ? "text-neg" : "text-foreground"}`}>
          {describeBackup(staleness)}
        </dd>
      </div>
    </dl>
  );
}
