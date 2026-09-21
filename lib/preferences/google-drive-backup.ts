"use client";

const GOOGLE_DRIVE_BACKUP_PREFERENCES_KEY = "moat.google-drive-backup";

export type GoogleDriveBackupPreferences = {
  provider: "google_drive";
  wasConnected: boolean;
  autoBackupEnabled: boolean;
  lastBackupAt?: string;
  lastBackupName?: string;
  lastAutoBackupAt?: string;
  /** Timestamp of the last automatic attempt that failed. No error details are stored. */
  lastAutoBackupErrorAt?: string;
  lastRestoredAt?: string;
  lastRestoredName?: string;
};

const defaultPreferences: GoogleDriveBackupPreferences = {
  provider: "google_drive",
  wasConnected: false,
  autoBackupEnabled: false,
};

export function readGoogleDriveBackupPreferences(): GoogleDriveBackupPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(GOOGLE_DRIVE_BACKUP_PREFERENCES_KEY);
    if (!raw) {
      return defaultPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<GoogleDriveBackupPreferences>;
    return {
      provider: "google_drive",
      wasConnected: parsed.wasConnected === true,
      autoBackupEnabled: parsed.autoBackupEnabled === true,
      lastBackupAt: typeof parsed.lastBackupAt === "string" ? parsed.lastBackupAt : undefined,
      lastBackupName: typeof parsed.lastBackupName === "string" ? parsed.lastBackupName : undefined,
      lastAutoBackupAt:
        typeof parsed.lastAutoBackupAt === "string" ? parsed.lastAutoBackupAt : undefined,
      lastAutoBackupErrorAt:
        typeof parsed.lastAutoBackupErrorAt === "string" ? parsed.lastAutoBackupErrorAt : undefined,
      lastRestoredAt:
        typeof parsed.lastRestoredAt === "string" ? parsed.lastRestoredAt : undefined,
      lastRestoredName:
        typeof parsed.lastRestoredName === "string" ? parsed.lastRestoredName : undefined,
    };
  } catch {
    return defaultPreferences;
  }
}

export function saveGoogleDriveBackupPreferences(
  preferences: GoogleDriveBackupPreferences,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GOOGLE_DRIVE_BACKUP_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // A full or unavailable store is not worth throwing over, and this is
    // written from the failure path of a backup, where a device short of room is
    // the likeliest reason the backup failed in the first place.
  }
}

// A stamp older than the last success is a failure already answered. An
// unreadable one counts as unresolved, because this exists to say a backup
// stopped working and staying quiet is the failure it reports on.
export function hasUnresolvedAutoBackupFailure(
  preferences: GoogleDriveBackupPreferences,
): boolean {
  if (!preferences.lastAutoBackupErrorAt) return false;
  if (!preferences.lastAutoBackupAt) return true;

  const failedAt = new Date(preferences.lastAutoBackupErrorAt).getTime();
  const succeededAt = new Date(preferences.lastAutoBackupAt).getTime();

  if (Number.isNaN(failedAt)) return true;
  if (Number.isNaN(succeededAt)) return true;

  return failedAt > succeededAt;
}
