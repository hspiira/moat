"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";

import {
  createGoogleDriveBackupClient,
  type GoogleDriveBackupFile,
} from "@/lib/integrations/google-drive-backup";
import {
  readGoogleDriveBackupPreferences,
  saveGoogleDriveBackupPreferences,
  type GoogleDriveBackupPreferences,
} from "@/lib/preferences/google-drive-backup";
import {
  createEncryptedBackupBlob,
  restoreEncryptedBackupPayload,
} from "@/lib/security/encrypted-backup";
import { downloadBlob } from "@/lib/security/data-export";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BackupMode = "idle" | "backup" | "restore" | "drive";

export function BackupPanel() {
  const [mode, setMode] = useState<BackupMode>("idle");
  const [backupPin, setBackupPin] = useState("");
  const [restorePin, setRestorePin] = useState("");
  const [driveBackupPin, setDriveBackupPin] = useState("");
  const [driveRestorePin, setDriveRestorePin] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driveClient] = useState(() => createGoogleDriveBackupClient());
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [drivePreferences, setDrivePreferences] = useState<GoogleDriveBackupPreferences>(
    () => readGoogleDriveBackupPreferences(),
  );
  const [isDriveHydrating, setIsDriveHydrating] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMode("idle");
    setBackupPin("");
    setRestorePin("");
    setDriveBackupPin("");
    setDriveRestorePin("");
    setError(null);
    setIsWorking(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function refreshDriveFiles() {
    const files = await driveClient.listBackups();
    setDriveFiles(files);
  }

  function updateDrivePreferences(
    updater: (current: GoogleDriveBackupPreferences) => GoogleDriveBackupPreferences,
  ) {
    setDrivePreferences((current) => {
      const next = updater(current);
      saveGoogleDriveBackupPreferences(next);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const savedPreferences = readGoogleDriveBackupPreferences();
      if (!cancelled) {
        setDrivePreferences(savedPreferences);
      }

      if (!savedPreferences.wasConnected) {
        if (!cancelled) setIsDriveHydrating(false);
        return;
      }

      const restored = await driveClient.restoreSession();
      if (cancelled) return;

      setIsDriveConnected(restored);
      if (restored) {
        try {
          await refreshDriveFiles();
        } catch {
          // Keep metadata visible even if listing fails on hydrate.
        }
      }

      setIsDriveHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [driveClient]);

  async function handleBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (backupPin.length < 4) {
      setError("Backup PIN must be at least 4 digits.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const { blob, filename } = await createEncryptedBackupBlob({ pin: backupPin });
      downloadBlob(blob, filename);
      updateDrivePreferences((current) => ({
        ...current,
        lastBackupAt: new Date().toISOString(),
        lastBackupName: filename,
      }));
      setSuccess("Encrypted backup downloaded. Store it somewhere safe.");
      setMode("idle");
      setBackupPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRestore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Select a backup file first.");
      return;
    }
    if (restorePin.length < 4) {
      setError("Enter the PIN used to create this backup.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      await restoreEncryptedBackupPayload({ payloadText: text, pin: restorePin });
      updateDrivePreferences((current) => ({
        ...current,
        lastRestoredAt: new Date().toISOString(),
        lastRestoredName: file.name,
      }));

      setSuccess("Backup restored successfully. Reload the app to see your data.");
      reset();
    } catch {
      setError("Could not restore backup. Check that you selected the correct file and PIN.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveConnect() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await driveClient.signIn();
      setIsDriveConnected(driveClient.isConnected());
      updateDrivePreferences((current) => ({
        ...current,
        wasConnected: true,
      }));
      await refreshDriveFiles();
      setSuccess("Google Drive connected. Your encrypted backups can now be uploaded or restored.");
    } catch (err) {
      setError(err instanceof Error ? `Google sign-in failed: ${err.message}` : "Google sign-in failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveUpload() {
    if (driveBackupPin.length < 4) {
      setError("Backup PIN must be at least 4 digits before uploading to Google Drive.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const { blob, filename } = await createEncryptedBackupBlob({ pin: driveBackupPin });
      await driveClient.uploadBackup({ filename, blob });
      await refreshDriveFiles();
      updateDrivePreferences((current) => ({
        ...current,
        wasConnected: true,
        lastBackupAt: new Date().toISOString(),
        lastBackupName: filename,
      }));
      setDriveBackupPin("");
      setSuccess("Encrypted backup uploaded to your Google Drive app folder.");
    } catch (err) {
      setError(err instanceof Error ? `Drive upload failed: ${err.message}` : "Drive upload failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveRestore(fileId: string) {
    if (driveRestorePin.length < 4) {
      setError("Enter the backup PIN used for the selected Google Drive backup.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadText = await driveClient.downloadBackup(fileId);
      const restoredFile = driveFiles.find((file) => file.fileId === fileId) ?? null;
      await restoreEncryptedBackupPayload({
        payloadText,
        pin: driveRestorePin,
      });
      updateDrivePreferences((current) => ({
        ...current,
        wasConnected: true,
        lastRestoredAt: new Date().toISOString(),
        lastRestoredName: restoredFile?.name,
      }));
      setSuccess("Google Drive backup restored successfully. Reload the app to see your data.");
      setDriveRestorePin("");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Drive restore failed: ${err.message}`
          : "Drive restore failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  const shouldShowDriveReminder = drivePreferences.wasConnected && !drivePreferences.lastBackupAt;

  async function handleDriveDisconnect() {
    await driveClient.signOut();
    setIsDriveConnected(false);
    setDriveFiles([]);
    updateDrivePreferences((current) => ({
      ...current,
      wasConnected: false,
    }));
    setSuccess("Google Drive disconnected for this session.");
  }

  return (
    <Card className="border-border/30 shadow-none">
        <CardHeader className="pb-3">
        <CardTitle className="text-base">Encrypted backup</CardTitle>
        <CardDescription>
          Download an AES-GCM encrypted backup of all your data, protected by a PIN you choose.
          Use this to protect against accidental data loss or to move data between devices.
        </CardDescription>
      </CardHeader>
        <CardContent className="space-y-4">
        {shouldShowDriveReminder ? (
          <p className="text-xs text-muted-foreground">
            Google Drive was connected before, but no recent backup metadata is stored on this device yet. Upload a fresh encrypted backup after reconnecting.
          </p>
        ) : null}
        {success ? (
          <p className="text-xs text-muted-foreground">{success}</p>
        ) : null}

        {mode === "idle" && (drivePreferences.lastBackupAt || drivePreferences.lastRestoredAt) ? (
          <div className="grid gap-1 text-xs text-muted-foreground">
            {drivePreferences.lastBackupAt ? (
              <div>
                Last backup:{" "}
                <span className="text-foreground">
                  {drivePreferences.lastBackupName ?? "Encrypted backup"}
                </span>
                {" · "}
                {formatDistanceToNow(new Date(drivePreferences.lastBackupAt), {
                  addSuffix: true,
                })}
              </div>
            ) : null}
            {drivePreferences.lastRestoredAt ? (
              <div>
                Last restore:{" "}
                <span className="text-foreground">
                  {drivePreferences.lastRestoredName ?? "Encrypted backup"}
                </span>
                {" · "}
                {formatDistanceToNow(new Date(drivePreferences.lastRestoredAt), {
                  addSuffix: true,
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setMode("backup"); setSuccess(null); }}
            >
              Download encrypted backup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMode("restore"); setSuccess(null); }}
            >
              Restore from backup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMode("drive"); setSuccess(null); }}
            >
              Google Drive backup
            </Button>
          </div>
        ) : null}

        {mode === "backup" ? (
          <form className="grid gap-4" onSubmit={(e) => void handleBackup(e)}>
            <div className="grid gap-2">
              <Label htmlFor="backup-pin" className="text-xs">
                Backup PIN (minimum 4 digits — you need this to restore)
              </Label>
              <Input
                id="backup-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={backupPin}
                onChange={(e) => setBackupPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Choose a PIN for this backup"
                autoComplete="new-password"
                className="tracking-[0.3em]"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isWorking}>
                {isWorking ? "Encrypting..." : "Encrypt and download"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "restore" ? (
          <form className="grid gap-4" onSubmit={(e) => void handleRestore(e)}>
            <div className="grid gap-2">
              <Label htmlFor="restore-file" className="text-xs">Backup file (.enc)</Label>
              <input
                id="restore-file"
                ref={fileInputRef}
                type="file"
                accept=".enc,application/octet-stream"
                className="text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restore-pin" className="text-xs">Backup PIN</Label>
              <Input
                id="restore-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={restorePin}
                onChange={(e) => setRestorePin(e.target.value.replace(/\D/g, ""))}
                placeholder="PIN used when creating this backup"
                autoComplete="current-password"
                className="tracking-[0.3em]"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isWorking}>
                {isWorking ? "Restoring..." : "Restore backup"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "drive" ? (
          <div className="grid gap-4">
            <div className="text-xs text-muted-foreground">
              Google Drive stores encrypted recovery files only. This is backup and restore, not
              live sync.
            </div>

            {isDriveHydrating ? (
              <div className="text-xs text-muted-foreground">
                Checking whether your previous Google Drive session can be restored…
              </div>
            ) : null}

            {!isDriveConnected ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => void handleDriveConnect()} disabled={isWorking}>
                  {isWorking ? "Connecting..." : "Connect Google Drive"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    Connected to Google Drive.
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void refreshDriveFiles()}>
                    Refresh list
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleDriveDisconnect()}>
                    Disconnect
                  </Button>
                </div>

                <div className="grid gap-3 border border-border/30 p-4">
                  <div className="text-sm font-medium text-foreground">Upload encrypted backup</div>
                  <div className="grid gap-2">
                    <Label htmlFor="drive-backup-pin" className="text-xs">
                      Backup PIN
                    </Label>
                    <Input
                      id="drive-backup-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={12}
                      value={driveBackupPin}
                      onChange={(e) => setDriveBackupPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="PIN used to encrypt this backup"
                      autoComplete="new-password"
                      className="tracking-[0.3em]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void handleDriveUpload()} disabled={isWorking}>
                      {isWorking ? "Uploading..." : "Upload encrypted backup"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 border border-border/30 p-4">
                  <div className="text-sm font-medium text-foreground">Restore from Google Drive</div>
                  <div className="grid gap-2">
                    <Label htmlFor="drive-restore-pin" className="text-xs">
                      Backup PIN
                    </Label>
                    <Input
                      id="drive-restore-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={12}
                      value={driveRestorePin}
                      onChange={(e) => setDriveRestorePin(e.target.value.replace(/\D/g, ""))}
                      placeholder="PIN used when creating the selected backup"
                      autoComplete="current-password"
                      className="tracking-[0.3em]"
                    />
                  </div>

                  {driveFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No Moat backups found in your Google Drive app folder yet.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {driveFiles.map((file) => (
                        <div
                          key={file.fileId}
                          className="flex flex-col gap-2 border border-border/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-foreground">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
                              {file.size ? ` · ${file.size} bytes` : ""}
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
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={reset}>
                    Close Google Drive backup
                  </Button>
                </div>
              </>
            )}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
