"use client";

import { useCallback, useEffect, useRef } from "react";

import { isDailyBackupDue } from "@/lib/domain/backup-staleness";
import { runDailyDriveBackup } from "@/lib/integrations/auto-backup";
import { loadKeyVaultFromDrive } from "@/lib/integrations/drive-key-vault";
import {
  createGoogleDriveBackupClient,
  isGoogleDriveConfigured,
  type GoogleDriveBackupClient,
} from "@/lib/integrations/google-drive-backup";
import {
  readGoogleDriveBackupPreferences,
  saveGoogleDriveBackupPreferences,
} from "@/lib/preferences/google-drive-backup";
import { clearStorageNotice } from "@/lib/preferences/storage-notice";
import { usePinLock } from "@/lib/security/pin-lock-context";
import { getActiveRecordCryptoKey } from "@/lib/security/record-crypto";

export function DailyDriveBackup() {
  const { lockState } = usePinLock();
  const running = useRef(false);
  const client = useRef<GoogleDriveBackupClient | null>(null);
  // Without a vault there is nothing useful to upload, and every tab switch
  // would otherwise ask Drive again for an answer that will not have changed.
  const givenUpThisSession = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    if (!isGoogleDriveConfigured()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const preferences = readGoogleDriveBackupPreferences();
    if (!preferences.wasConnected || !preferences.autoBackupEnabled) return;
    if (!isDailyBackupDue(preferences.lastAutoBackupAt ?? preferences.lastBackupAt)) return;

    const dek = getActiveRecordCryptoKey();
    if (!dek) return;
    if (givenUpThisSession.current) return;

    running.current = true;
    try {
      client.current ??= createGoogleDriveBackupClient();
      const drive = client.current;

      // Silent only: an automatic backup must never raise a Google consent
      // window over whatever the user is actually doing.
      if (!drive.isConnected() && !(await drive.restoreSession())) return;

      // A sealed backup is worth nothing once this device is gone unless the key
      // that opens it is already in Drive, so the vault has to be there first.
      if (!(await loadKeyVaultFromDrive(drive))) {
        givenUpThisSession.current = true;
        return;
      }

      const { filename } = await runDailyDriveBackup({ client: drive, dek });
      const now = new Date().toISOString();

      saveGoogleDriveBackupPreferences({
        ...readGoogleDriveBackupPreferences(),
        lastBackupAt: now,
        lastBackupName: filename,
        lastAutoBackupAt: now,
        lastAutoBackupErrorAt: undefined,
      });
      clearStorageNotice("stale-backup");
    } catch {
      // Set before anything else can fail, so one failure stays one attempt.
      givenUpThisSession.current = true;

      // Recorded without the provider's words and without interrupting whatever
      // the user is doing. The settings panel turns it into a retry.
      saveGoogleDriveBackupPreferences({
        ...readGoogleDriveBackupPreferences(),
        lastAutoBackupErrorAt: new Date().toISOString(),
      });
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (lockState.status !== "unlocked") return;

    void run();

    function onVisible() {
      if (document.visibilityState === "visible") void run();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [lockState.status, run]);

  return null;
}
