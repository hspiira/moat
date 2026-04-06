"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createGoogleDriveBackupClient,
  type GoogleDriveBackupFile,
} from "@/lib/integrations/google-drive-backup";
import {
  readGoogleDriveBackupPreferences,
  saveGoogleDriveBackupPreferences,
  type GoogleDriveBackupPreferences,
} from "@/lib/preferences/google-drive-backup";
import { restoreEncryptedBackupPayload } from "@/lib/security/encrypted-backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RecoveryMode = "file" | "drive";

export function OnboardingRecoveryPanel({
  mode,
  onBack,
  onRestored,
}: {
  mode: RecoveryMode;
  onBack: () => void;
  onRestored: () => void;
}) {
  const driveClient = useMemo(() => createGoogleDriveBackupClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restorePin, setRestorePin] = useState("");
  const [driveRestorePin, setDriveRestorePin] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [drivePreferences, setDrivePreferences] = useState<GoogleDriveBackupPreferences>(
    () => readGoogleDriveBackupPreferences(),
  );

  function updateDrivePreferences(
    updater: (current: GoogleDriveBackupPreferences) => GoogleDriveBackupPreferences,
  ) {
    setDrivePreferences((current) => {
      const next = updater(current);
      saveGoogleDriveBackupPreferences(next);
      return next;
    });
  }

  async function refreshDriveFiles() {
    setDriveFiles(await driveClient.listBackups());
  }

  useEffect(() => {
    if (mode !== "drive") {
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!drivePreferences.wasConnected) {
        return;
      }

      const restored = await driveClient.restoreSession();
      if (cancelled) {
        return;
      }

      setIsDriveConnected(restored);
      if (restored) {
        try {
          await refreshDriveFiles();
        } catch {
          // Leave the user in manual reconnect mode if listing fails.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [driveClient, drivePreferences.wasConnected, mode]);

  async function handleFileRestore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Select an encrypted backup file first.");
      return;
    }
    if (restorePin.length < 4) {
      setError("Enter the backup PIN used when the file was created.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      await restoreEncryptedBackupPayload({
        payloadText: await file.text(),
        pin: restorePin,
      });
      updateDrivePreferences((current) => ({
        ...current,
        lastRestoredAt: new Date().toISOString(),
        lastRestoredName: file.name,
      }));
      setSuccess("Backup restored successfully.");
      onRestored();
    } catch {
      setError("Could not restore that backup. Check the file and backup PIN.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveConnect() {
    setIsWorking(true);
    setError(null);

    try {
      await driveClient.signIn();
      setIsDriveConnected(true);
      updateDrivePreferences((current) => ({ ...current, wasConnected: true }));
      await refreshDriveFiles();
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? `Google sign-in failed: ${connectError.message}`
          : "Google sign-in failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveRestore(fileId: string) {
    if (driveRestorePin.length < 4) {
      setError("Enter the backup PIN for the Google Drive backup you want to restore.");
      return;
    }

    setIsWorking(true);
    setError(null);

    try {
      const payloadText = await driveClient.downloadBackup(fileId);
      const restoredFile = driveFiles.find((file) => file.fileId === fileId) ?? null;
      await restoreEncryptedBackupPayload({ payloadText, pin: driveRestorePin });
      updateDrivePreferences((current) => ({
        ...current,
        wasConnected: true,
        lastRestoredAt: new Date().toISOString(),
        lastRestoredName: restoredFile?.name,
      }));
      setSuccess("Google Drive backup restored successfully.");
      onRestored();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? `Drive restore failed: ${restoreError.message}`
          : "Drive restore failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Card className="border-border/40 shadow-none">
      <CardContent className="grid gap-5 pt-6">
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">
            {mode === "file" ? "Restore from encrypted file" : "Restore from Google Drive"}
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "file"
              ? "Bring back a backup file you created earlier, then continue with the restored account."
              : "Connect to Google Drive, choose a Moat backup, and restore it with your backup PIN."}
          </p>
        </div>

        {drivePreferences.wasConnected && !drivePreferences.lastBackupAt ? (
          <div className="text-xs text-muted-foreground">
            Google Drive was connected before, but no recent backup metadata is stored on this device yet.
          </div>
        ) : null}

        {success ? <div className="text-xs text-muted-foreground">{success}</div> : null}
        {error ? <div className="text-xs text-destructive">{error}</div> : null}

        {mode === "file" ? (
          <form className="grid gap-4" onSubmit={(event) => void handleFileRestore(event)}>
            <div className="grid gap-2">
              <Label htmlFor="restore-file">Encrypted backup file</Label>
              <Input
                id="restore-file"
                ref={fileInputRef}
                type="file"
                accept=".enc,.json,application/octet-stream,application/json"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restore-pin">Backup PIN</Label>
              <Input
                id="restore-pin"
                type="password"
                inputMode="numeric"
                value={restorePin}
                onChange={(event) => setRestorePin(event.target.value)}
                placeholder="Enter backup PIN"
                autoComplete="current-password"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isWorking}>
                {isWorking ? "Restoring..." : "Restore backup"}
              </Button>
              <Button type="button" variant="outline" onClick={onBack} disabled={isWorking}>
                Back
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4">
            {!isDriveConnected ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleDriveConnect()} disabled={isWorking}>
                  {isWorking ? "Connecting..." : "Connect Google Drive"}
                </Button>
                <Button type="button" variant="outline" onClick={onBack} disabled={isWorking}>
                  Back
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="drive-restore-pin">Backup PIN</Label>
                  <Input
                    id="drive-restore-pin"
                    type="password"
                    inputMode="numeric"
                    value={driveRestorePin}
                    onChange={(event) => setDriveRestorePin(event.target.value)}
                    placeholder="Enter backup PIN"
                    autoComplete="current-password"
                  />
                </div>

                <div className="grid gap-3">
                  {driveFiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No Moat backups were found in your Google Drive app folder.
                    </div>
                  ) : (
                    driveFiles.map((file) => (
                      <div
                        key={file.fileId}
                        className="flex flex-col gap-3 rounded-md border border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="grid gap-1">
                          <div className="text-sm text-foreground">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Updated {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isWorking}
                          onClick={() => void handleDriveRestore(file.fileId)}
                        >
                          {isWorking ? "Restoring..." : "Restore this backup"}
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={onBack} disabled={isWorking}>
                    Back
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
