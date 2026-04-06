"use client";

const GOOGLE_DRIVE_BACKUP_PREFERENCES_KEY = "moat.google-drive-backup";

export type GoogleDriveBackupPreferences = {
  provider: "google_drive";
  wasConnected: boolean;
  lastBackupAt?: string;
  lastBackupName?: string;
  lastRestoredAt?: string;
  lastRestoredName?: string;
};

const defaultPreferences: GoogleDriveBackupPreferences = {
  provider: "google_drive",
  wasConnected: false,
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
      lastBackupAt: typeof parsed.lastBackupAt === "string" ? parsed.lastBackupAt : undefined,
      lastBackupName: typeof parsed.lastBackupName === "string" ? parsed.lastBackupName : undefined,
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
  window.localStorage.setItem(
    GOOGLE_DRIVE_BACKUP_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
}
