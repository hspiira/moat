"use client";

import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";

import { runDailyDriveBackup } from "@/lib/integrations/auto-backup";
import {
  loadKeyVaultFromDrive,
  publishKeyVaultToDrive,
} from "@/lib/integrations/drive-key-vault";
import {
  createGoogleDriveBackupClient,
  isGoogleDriveConfigured,
  type GoogleDriveBackupFile,
} from "@/lib/integrations/google-drive-backup";
import { repositories } from "@/lib/repositories/instance";
import {
  readGoogleDriveBackupPreferences,
  saveGoogleDriveBackupPreferences,
  type GoogleDriveBackupPreferences,
} from "@/lib/preferences/google-drive-backup";
import { clearStorageNotice } from "@/lib/preferences/storage-notice";
import {
  createEncryptedBackupBlob,
  decryptEncryptedBackupPayload,
} from "@/lib/security/encrypted-backup";
import { detectBackupFormat } from "@/lib/security/backup-format";
import { planBackupRestore } from "@/lib/domain/backup-restore-plan";
import { restoreFullExport } from "@/lib/security/data-export";
import { downloadBlob } from "@/lib/security/data-export";
import {
  RECOVERY_PASSPHRASE_REQUIREMENT,
  isValidRecoveryPassphrase,
} from "@/lib/security/key-vault";
import { recordKeyVaultPublished } from "@/lib/preferences/key-vault-state";
import { readStoredPasskeyMaterial } from "@/lib/security/pin-lock-context";
import {
  SealedBackupError,
  isSealedBackupFilename,
  restoreSealedBackup,
} from "@/lib/security/sealed-backup";
import type { KeyVault } from "@/lib/security/key-vault";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";
import { getActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import { InputField } from "@/components/forms/input-field";
import { PinInputField } from "@/components/forms/pin-input-field";
import { Checkbox } from "@/components/ui/checkbox";
import { DriveRecoverySection, type VaultState } from "./drive-recovery-section";
import { ErrorNotice } from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StorageDurabilityRow } from "./storage-durability-row";

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
  // "unreadable" is deliberately not "absent": a vault this build cannot parse
  // may still be the only thing another device can open, so it must not be
  // overwritten on a guess.
  const [vaultState, setVaultState] = useState<VaultState>("checking");
  const [vault, setVault] = useState<KeyVault | null>(null);
  const [wantsDailyBackup, setWantsDailyBackup] = useState(true);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [isReplacingRecovery, setIsReplacingRecovery] = useState(false);
  const [hasDeviceKey, setHasDeviceKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMode("idle");
    setBackupPin("");
    setRestorePin("");
    setDriveBackupPin("");
    setDriveRestorePin("");
    setRecoveryPassphrase("");
    setRecoveryConfirm("");
    setIsReplacingRecovery(false);
    setError(null);
    setIsWorking(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const refreshDriveFiles = useCallback(async () => {
    const files = await driveClient.listBackups();
    setDriveFiles(files);
  }, [driveClient]);

  useEffect(() => {
    setHasDeviceKey(getActiveRecordCryptoKey() !== null);
  }, [mode]);

  const refreshVaultState = useCallback(async () => {
    try {
      const stored = await loadKeyVaultFromDrive(driveClient);
      setVault(stored);
      setVaultState(stored ? "present" : "absent");
    } catch {
      setVault(null);
      setVaultState("unreadable");
    }
  }, [driveClient]);

  function updateDrivePreferences(
    updater: (current: GoogleDriveBackupPreferences) => GoogleDriveBackupPreferences,
  ) {
    setDrivePreferences((current) => {
      const next = updater(current);
      saveGoogleDriveBackupPreferences(next);
      if (next.lastBackupAt !== current.lastBackupAt) {
        clearStorageNotice("stale-backup");
      }
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
          await refreshVaultState();
        } catch {
        }
      }

      setIsDriveHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [driveClient, refreshDriveFiles, refreshVaultState]);

  async function handleBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (backupPin.length < MIN_PIN_LENGTH) {
      setError(`Backup PIN must be at least ${MIN_PIN_LENGTH} digits.`);
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

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const format = detectBackupFormat(text);

      const plan = planBackupRestore(format, {
        hasDeviceKey: getActiveRecordCryptoKey() !== null,
        pinLength: restorePin.length,
      });

      if (plan.action === "refuse") {
        setError(plan.reason);
        return;
      }

      if (plan.action === "plain" && format.kind === "plain") {
        await restoreFullExport(format.payload);
        updateDrivePreferences((current) => ({
          ...current,
          lastRestoredAt: new Date().toISOString(),
          lastRestoredName: file.name,
        }));
        setSuccess(
          "Unencrypted export restored. Reload the app to see your data. Consider deleting that file, it holds your records in plain text.",
        );
        reset();
        return;
      }

      if (plan.action === "sealed" && format.kind === "sealed") {
        const dek = getActiveRecordCryptoKey() as CryptoKey;

        try {
          await restoreSealedBackup({ payload: format.payload, dek });
        } catch {
          setError(
            "That sealed backup was not made with this device's key. Open the ledger on this device first, using your recovery passphrase.",
          );
          return;
        }

        updateDrivePreferences((current) => ({
          ...current,
          lastRestoredAt: new Date().toISOString(),
          lastRestoredName: file.name,
        }));
        setSuccess("Backup restored successfully. Reload the app to see your data.");
        reset();
        return;
      }

      let decrypted;
      try {
        decrypted = await decryptEncryptedBackupPayload({ payloadText: text, pin: restorePin });
      } catch {
        setError("Could not decrypt this backup. Check the PIN used when it was created.");
        return;
      }

      await restoreFullExport(decrypted);
      updateDrivePreferences((current) => ({
        ...current,
        lastRestoredAt: new Date().toISOString(),
        lastRestoredName: file.name,
      }));

      setSuccess("Backup restored successfully. Reload the app to see your data.");
      reset();
    } catch (err) {
      setError(
        err instanceof Error ? `Restore failed: ${err.message}` : "Restore failed.",
      );
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
      await refreshVaultState();
      setSuccess("Google Drive connected. Your encrypted backups can now be uploaded or restored.");
    } catch (err) {
      setError(err instanceof Error ? `Google sign-in failed: ${err.message}` : "Google sign-in failed.");
    } finally {
      setIsWorking(false);
    }
  }

  function checkRecoveryInput(): string | null {
    if (!isValidRecoveryPassphrase(recoveryPassphrase)) {
      return RECOVERY_PASSPHRASE_REQUIREMENT;
    }
    if (recoveryPassphrase !== recoveryConfirm) {
      return "Those two recovery passphrases do not match.";
    }
    return null;
  }

  async function storeKeyVault(dek: CryptoKey) {
    const user = await repositories.userProfile.get();
    if (!user) {
      throw new Error("This device has no profile yet, so there is no key to store.");
    }

    const published = await publishKeyVaultToDrive({
      client: driveClient,
      dek,
      userId: user.id,
      passphrase: recoveryPassphrase,
      passkey: readStoredPasskeyMaterial(),
    });

    recordKeyVaultPublished(published.updatedAt);
    setVault(published);
    setVaultState("present");
    setRecoveryPassphrase("");
    setRecoveryConfirm("");
    setIsReplacingRecovery(false);
  }

  async function handleSealedUploadNow() {
    const dek = getActiveRecordCryptoKey();
    if (!dek) {
      setError("Unlock Moat first.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const { filename, pruned } = await runDailyDriveBackup({ client: driveClient, dek });
      await refreshDriveFiles();
      const now = new Date().toISOString();
      updateDrivePreferences((current) => ({
        ...current,
        wasConnected: true,
        lastBackupAt: now,
        lastBackupName: filename,
        lastAutoBackupAt: now,
      }));
      setSuccess(
        pruned > 0
          ? `Backup uploaded, and ${pruned} older automatic backups were removed.`
          : "Backup uploaded. It opens with your recovery passphrase on any device.",
      );
    } catch (err) {
      setError(err instanceof Error ? `Drive upload failed: ${err.message}` : "Drive upload failed.");
    } finally {
      setIsWorking(false);
    }
  }

  function handleToggleAutoBackup(next: boolean) {
    updateDrivePreferences((current) => ({ ...current, autoBackupEnabled: next }));
    setSuccess(
      next
        ? "Moat will upload a sealed backup once a day while it is unlocked."
        : "Automatic daily backups are off.",
    );
  }

  async function handleDriveUpload() {
    if (driveBackupPin.length < MIN_PIN_LENGTH) {
      setError(`Backup PIN must be at least ${MIN_PIN_LENGTH} digits before uploading to Google Drive.`);
      return;
    }

    const dek = getActiveRecordCryptoKey();
    const shouldStoreVault = dek !== null && vaultState === "absent";

    if (shouldStoreVault) {
      const problem = checkRecoveryInput();
      if (problem) {
        setError(problem);
        return;
      }
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

      // The backup is already safe at this point, so a failure to store the key
      // must not read as a failed backup.
      if (shouldStoreVault && dek) {
        try {
          await storeKeyVault(dek);
          if (wantsDailyBackup) {
            updateDrivePreferences((current) => ({ ...current, autoBackupEnabled: true }));
          }
          setSuccess(
            "Encrypted backup uploaded, and your recovery key is now in your Drive app folder. A new device can open this backup with your recovery passphrase.",
          );
          return;
        } catch (err) {
          setError(
            err instanceof Error
              ? `Backup uploaded, but the recovery key was not stored: ${err.message}`
              : "Backup uploaded, but the recovery key was not stored.",
          );
          return;
        }
      }

      setSuccess("Encrypted backup uploaded to your Google Drive app folder.");
    } catch (err) {
      setError(err instanceof Error ? `Drive upload failed: ${err.message}` : "Drive upload failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReplaceRecoveryPassphrase() {
    const dek = getActiveRecordCryptoKey();
    if (!dek) {
      setError("Unlock Moat first, then set a recovery passphrase.");
      return;
    }

    const problem = checkRecoveryInput();
    if (problem) {
      setError(problem);
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await storeKeyVault(dek);
      setSuccess("Recovery passphrase saved. The previous one no longer opens your data.");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not store the recovery key: ${err.message}`
          : "Could not store the recovery key.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDriveRestore(fileId: string) {
    const restoredFile = driveFiles.find((file) => file.fileId === fileId) ?? null;
    const isSealed = restoredFile ? isSealedBackupFilename(restoredFile.name) : false;
    const dek = getActiveRecordCryptoKey();

    if (isSealed && !dek) {
      setError("Unlock Moat first, a sealed backup opens with this device's key.");
      return;
    }

    if (!isSealed && driveRestorePin.length < 4) {
      setError("Enter the backup PIN used for the selected Google Drive backup.");
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadText = await driveClient.downloadBackup(fileId);

      if (isSealed && dek) {
        const format = detectBackupFormat(payloadText);

        if (format.kind !== "sealed") {
          setError("That file is named as a sealed backup but is not one.");
          return;
        }

        await restoreSealedBackup({ payload: format.payload, dek });
        updateDrivePreferences((current) => ({
          ...current,
          wasConnected: true,
          lastRestoredAt: new Date().toISOString(),
          lastRestoredName: restoredFile?.name,
        }));
        setSuccess("Backup restored successfully. Reload the app to see your data.");
        return;
      }

      let decrypted;
      try {
        decrypted = await decryptEncryptedBackupPayload({ payloadText, pin: driveRestorePin });
      } catch {
        setError("Could not decrypt that backup. Check the PIN used when it was created.");
        return;
      }

      await restoreFullExport(decrypted);
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
        err instanceof SealedBackupError
          ? "That sealed backup was not made with this device's key. Open the ledger on this device first, using your recovery passphrase."
          : err instanceof Error
            ? `Drive restore failed: ${err.message}`
            : "Drive restore failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  const driveConfigured = isGoogleDriveConfigured();
  const shouldShowDriveReminder =
    driveConfigured && drivePreferences.wasConnected && !drivePreferences.lastBackupAt;

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
    <Card className="shadow-none">
        <CardHeader className="pb-3">
        <CardTitle className="text-base">Encrypted backup</CardTitle>
        <CardDescription>
          Locked with a PIN you choose. Use it to recover, or to move to another device.
        </CardDescription>
      </CardHeader>
        <CardContent className="space-y-4">
        <StorageDurabilityRow />
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
            {driveConfigured ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMode("drive"); setSuccess(null); }}
              >
                Google Drive backup
              </Button>
            ) : null}
          </div>
        ) : null}

        {mode === "backup" ? (
          <form className="grid gap-4" onSubmit={(e) => void handleBackup(e)}>
            <PinInputField
              id="backup-pin"
              label={`Backup PIN (minimum ${MIN_PIN_LENGTH} digits, you need this to restore)`}
              value={backupPin}
              onChange={setBackupPin}
              placeholder="Choose a PIN for this backup"
              autoComplete="new-password"
            />
            {error ? <ErrorNotice message={error} /> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isWorking}>
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
              <Label htmlFor="restore-file" className="text-xs">Backup file (.enc) or export (.json)</Label>
              <input
                id="restore-file"
                ref={fileInputRef}
                type="file"
                accept=".enc,.json,application/json,application/octet-stream"
                className="text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
              />
            </div>
            <PinInputField
              id="restore-pin"
              label="Backup PIN"
              value={restorePin}
              onChange={setRestorePin}
              placeholder="PIN used when creating this backup"
              autoComplete="current-password"
            />
            {error ? <ErrorNotice message={error} /> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isWorking}>
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

                <div className="grid gap-3 p-4">
                  <div className="text-sm font-medium text-foreground">Upload encrypted backup</div>
                  <PinInputField
                    id="drive-backup-pin"
                    label="Backup PIN"
                    value={driveBackupPin}
                    onChange={setDriveBackupPin}
                    placeholder="PIN used to encrypt this backup"
                    autoComplete="new-password"
                  />

                  {hasDeviceKey && (vaultState === "absent" || isReplacingRecovery) ? (
                    <>
                      <InputField
                        id="drive-recovery-passphrase"
                        type="password"
                        label="Recovery passphrase"
                        hint={RECOVERY_PASSPHRASE_REQUIREMENT}
                        value={recoveryPassphrase}
                        onChange={(event) => setRecoveryPassphrase(event.target.value)}
                        placeholder="Words you will still remember next year"
                        autoComplete="new-password"
                      />
                      <InputField
                        id="drive-recovery-confirm"
                        type="password"
                        label="Confirm recovery passphrase"
                        value={recoveryConfirm}
                        onChange={(event) => setRecoveryConfirm(event.target.value)}
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your key is stored in the same Drive app folder, wrapped so only this
                        passphrase, or a passkey, on a device that carries one, opens it. Neither
                        Moat nor Google can read your records with it. If you forget it and lose
                        your devices, nobody can recover the data.
                      </p>
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={wantsDailyBackup}
                          onCheckedChange={(checked) => setWantsDailyBackup(checked === true)}
                        />
                        <span>
                          Back up automatically once a day while Moat is unlocked. These uploads
                          need no PIN, they are sealed with your key, and Moat keeps the most
                          recent ones, removing older automatic backups.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {hasDeviceKey && vaultState === "present" && !isReplacingRecovery ? (
                    <p className="text-xs text-muted-foreground">
                      A recovery key is already in your Drive app folder, so a new device needs
                      only your recovery passphrase.{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="px-0"
                        onClick={() => {
                          setIsReplacingRecovery(true);
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        Replace it
                      </Button>
                    </p>
                  ) : null}

                  {vaultState === "present" ? (
                    <div className="grid gap-2">
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={drivePreferences.autoBackupEnabled}
                          onCheckedChange={(checked) => handleToggleAutoBackup(checked === true)}
                        />
                        <span>Back up automatically once a day while Moat is unlocked.</span>
                      </label>
                      {drivePreferences.lastAutoBackupAt ? (
                        <p className="text-xs text-muted-foreground">
                          Last automatic backup{" "}
                          {formatDistanceToNow(new Date(drivePreferences.lastAutoBackupAt), {
                            addSuffix: true,
                          })}
                          .
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isWorking}
                          onClick={() => void handleSealedUploadNow()}
                        >
                          {isWorking ? "Uploading..." : "Back up now, without a PIN"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {vaultState === "unreadable" ? (
                    <p className="text-xs text-muted-foreground">
                      There is a recovery file in your Drive app folder that this version cannot
                      read. It has been left alone rather than overwritten.
                    </p>
                  ) : null}

                  {!hasDeviceKey ? (
                    <p className="text-xs text-muted-foreground">
                      Set a PIN lock to also store a recovery key, which is what lets another
                      device open this backup without the file being handed over by hand.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void handleDriveUpload()} disabled={isWorking}>
                      {isWorking ? "Uploading..." : "Upload encrypted backup"}
                    </Button>
                    {isReplacingRecovery ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isWorking}
                          onClick={() => void handleReplaceRecoveryPassphrase()}
                        >
                          {isWorking ? "Saving..." : "Save recovery passphrase"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsReplacingRecovery(false);
                            setRecoveryPassphrase("");
                            setRecoveryConfirm("");
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  <div className="text-sm font-medium text-foreground">Restore from Google Drive</div>
                  <PinInputField
                    id="drive-restore-pin"
                    label="Backup PIN"
                    value={driveRestorePin}
                    onChange={setDriveRestorePin}
                    placeholder="PIN used when creating the selected backup"
                    autoComplete="current-password"
                  />

                  {driveFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No Moat backups found in your Google Drive app folder yet.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {driveFiles.map((file) => (
                        <div
                          key={file.fileId}
                          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-foreground">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
                              {file.size ? ` · ${file.size} bytes` : ""}
                              {isSealedBackupFilename(file.name)
                                ? " · opens with this device's key"
                                : " · needs its backup PIN"}
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

                <DriveRecoverySection
                  client={driveClient}
                  vault={vault}
                  vaultState={vaultState}
                  onVaultChanged={refreshVaultState}
                />

                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={reset}>
                    Close Google Drive backup
                  </Button>
                </div>
              </>
            )}

            {error ? <ErrorNotice message={error} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
