"use client";

import { useCallback, useEffect, useState } from "react";

import { checkVaultBelongsToLedger } from "@/lib/domain/key-vault-adoption";
import {
  keepNewestVaultOnly,
  loadKeyVaultFromDrive,
  removeVaultFromDrive,
  updateVaultPasskey,
} from "@/lib/integrations/drive-key-vault";
import type { GoogleDriveBackupClient } from "@/lib/integrations/google-drive-backup";
import {
  clearKeyVaultDrift,
  forgetKeyVaultState,
  readKeyVaultState,
  type KeyVaultDrift,
} from "@/lib/preferences/key-vault-state";
import { repositories } from "@/lib/repositories/instance";
import { base64ToBytes } from "@/lib/security/codec";
import { downloadBlob } from "@/lib/security/data-export";
import {
  KEY_VAULT_FILENAME,
  KeyVaultError,
  openWithPasskey,
  openWithRecoveryPassphrase,
  parseKeyVault,
  type KeyVault,
} from "@/lib/security/key-vault";
import { getPasskeyPrfOutput, isWebAuthnAvailable } from "@/lib/security/passkey";
import { readStoredPasskeyMaterial, usePinLock } from "@/lib/security/pin-lock-context";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";
import { InputField } from "@/components/forms/input-field";
import { PinInputField } from "@/components/forms/pin-input-field";
import { ErrorNotice } from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";

export type VaultState = "checking" | "absent" | "present" | "unreadable";

const driftWording: Record<KeyVaultDrift, string> = {
  "passkey-added":
    "Biometric unlock was set up on this device after your recovery file was written, so another device cannot use it yet.",
  "passkey-removed":
    "Biometric unlock was removed here, but your recovery file still lets a synced passkey open your data.",
  "key-discarded":
    "The PIN lock was removed on this device, so the key in your recovery file no longer opens anything.",
};

async function readLedgerFacts(): Promise<{ userId: string | null; recordCount: number }> {
  const profile = await repositories.userProfile.get();
  if (!profile) {
    return { userId: null, recordCount: 0 };
  }

  const [accounts, transactions] = await Promise.all([
    repositories.accounts.listByUser(profile.id),
    repositories.transactions.listByUser(profile.id),
  ]);

  return { userId: profile.id, recordCount: accounts.length + transactions.length };
}

export function DriveRecoverySection({
  client,
  vault,
  vaultState,
  onVaultChanged,
}: {
  client: GoogleDriveBackupClient;
  vault: KeyVault | null;
  vaultState: VaultState;
  onVaultChanged: () => Promise<void> | void;
}) {
  const { adoptDeviceKey } = usePinLock();
  const [drift, setDrift] = useState<KeyVaultDrift | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isAdopting, setIsAdopting] = useState(false);
  const [importedVault, setImportedVault] = useState<KeyVault | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [devicePin, setDevicePin] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

  useEffect(() => {
    setDrift(readKeyVaultState().drift ?? null);
  }, [vaultState]);

  useEffect(() => {
    if (vaultState !== "present") {
      setDuplicateCount(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const vaults = await client.listKeyVaults();
        if (!cancelled) setDuplicateCount(vaults.length);
      } catch {
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, vaultState]);

  const resetAdoption = useCallback(() => {
    setIsAdopting(false);
    setImportedVault(null);
    setPassphrase("");
    setDevicePin("");
    setError(null);
  }, []);

  async function handleUpdateRecoveryFile() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateVaultPasskey({
        client,
        passkey: readStoredPasskeyMaterial(),
      });

      if (!updated) {
        setError("There is no recovery file in Drive to update.");
        return;
      }

      clearKeyVaultDrift();
      setDrift(null);
      setSuccess("Recovery file updated to match this device.");
      await onVaultChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not update the recovery file: ${err.message}`
          : "Could not update the recovery file.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRemoveRecoveryFile() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await removeVaultFromDrive(client);
      forgetKeyVaultState();
      setDrift(null);
      setIsConfirmingRemoval(false);
      setSuccess("Recovery file removed from your Drive app folder.");
      await onVaultChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not remove the recovery file: ${err.message}`
          : "Could not remove the recovery file.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleKeepNewest() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const removed = await keepNewestVaultOnly(client);
      setDuplicateCount(1);
      setSuccess(
        removed === 1
          ? "Removed the older recovery file."
          : `Removed ${removed} older recovery files.`,
      );
      await onVaultChanged();
    } catch (err) {
      setError(
        err instanceof Error ? `Could not tidy up: ${err.message}` : "Could not tidy up.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleExport() {
    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await client.loadKeyVault();
      if (!text) {
        setError("There is no recovery file in Drive to save.");
        return;
      }

      downloadBlob(new Blob([text], { type: "application/json" }), KEY_VAULT_FILENAME);
      setSuccess(
        "Recovery file saved. It is useless without your recovery passphrase, but keep it somewhere you trust.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? `Could not save the file: ${err.message}` : "Could not save the file.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleChooseFile(file: File | null) {
    if (!file) return;

    setError(null);
    setSuccess(null);

    try {
      setImportedVault(parseKeyVault(await file.text()));
      setIsAdopting(true);
    } catch (err) {
      setError(err instanceof KeyVaultError ? err.message : "That file is not a Moat recovery file.");
    }
  }

  async function openVault(vault: KeyVault, withPasskey: boolean): Promise<CryptoKey> {
    if (!withPasskey) {
      return openWithRecoveryPassphrase(vault, passphrase);
    }

    if (!vault.passkey) {
      throw new KeyVaultError("This recovery file has no passkey registered.");
    }

    const prfOutput = await getPasskeyPrfOutput(
      vault.passkey.credentialId,
      base64ToBytes(vault.passkey.prfSalt),
    );
    return openWithPasskey(vault, prfOutput);
  }

  async function handleAdopt(withPasskey: boolean) {
    if (devicePin.length < MIN_PIN_LENGTH) {
      setError(`Choose a PIN of at least ${MIN_PIN_LENGTH} digits for this device.`);
      return;
    }

    setIsWorking(true);
    setError(null);
    setSuccess(null);

    try {
      const opening = importedVault ?? vault ?? (await loadKeyVaultFromDrive(client));
      if (!opening) {
        setError("There is no recovery file to open.");
        return;
      }

      const dek = await openVault(opening, withPasskey);

      const ledger = await readLedgerFacts();
      const allowed = checkVaultBelongsToLedger({
        vaultUserId: opening.userId,
        localUserId: ledger.userId,
        localRecordCount: ledger.recordCount,
      });

      if (!allowed.ok) {
        setError(allowed.reason);
        return;
      }

      const adopted = await adoptDeviceKey({
        dek,
        pin: devicePin,
        passkey: opening.passkey ?? null,
      });

      if (!adopted.ok) {
        setError(adopted.error ?? "This device could not adopt the recovery key.");
        return;
      }

      resetAdoption();
      setSuccess(
        "This device now holds the ledger's key. Restore the newest Drive backup below, or turn on hosted sync and let the records arrive.",
      );
      await onVaultChanged();
    } catch (err) {
      setError(
        err instanceof KeyVaultError
          ? err.message
          : err instanceof Error
            ? `Could not open the recovery file: ${err.message}`
            : "Could not open the recovery file.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  // Offered only when the file actually carries a passkey wrap, so the button
  // never sends someone to a sensor that cannot open anything.
  const canUsePasskey = isWebAuthnAvailable() && Boolean((importedVault ?? vault)?.passkey);

  return (
    <div className="grid gap-3 p-4">
      <div className="text-sm font-medium text-foreground">Recovery file</div>

      {vaultState === "checking" ? (
        <p className="text-xs text-muted-foreground">Checking your Drive app folder…</p>
      ) : null}

      {vaultState === "present" ? (
        <p className="text-xs text-muted-foreground">
          Your key is in your Drive app folder, wrapped by your recovery passphrase. Another
          device opens it with that passphrase, or with a passkey if the platform carries one.
        </p>
      ) : null}

      {vaultState === "absent" ? (
        <p className="text-xs text-muted-foreground">
          No recovery file yet. Set a recovery passphrase when you upload a backup above, or open
          one from a file below.
        </p>
      ) : null}

      {drift ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">{driftWording[drift]}</p>
          <div className="flex flex-wrap gap-2">
            {drift === "key-discarded" ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isWorking}
                onClick={() => setIsConfirmingRemoval(true)}
              >
                Remove recovery file
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() => void handleUpdateRecoveryFile()}
              >
                {isWorking ? "Updating..." : "Update recovery file"}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {duplicateCount > 1 ? (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            Your Drive app folder holds {duplicateCount} recovery files, which happens when two
            devices each wrote one. Only the newest is used, and the others may open a different
            ledger.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isWorking}
              onClick={() => void handleKeepNewest()}
            >
              Keep the newest, remove the rest
            </Button>
          </div>
        </div>
      ) : null}

      {!isAdopting ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isWorking || vaultState !== "present"}
            onClick={() => void handleExport()}
          >
            Save a copy of the recovery file
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsAdopting(true);
              setError(null);
              setSuccess(null);
            }}
          >
            Open this ledger on this device
          </Button>
        </div>
      ) : null}

      {isAdopting ? (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            This re-seals everything already on this device under the ledger&apos;s key, so synced
            records and sealed backups open here. Records you have entered on this device are kept.
          </p>

          {vaultState !== "present" || importedVault ? (
            <div className="grid gap-2">
              <Label htmlFor="recovery-file" className="text-xs">
                Recovery file {importedVault ? "(loaded)" : "(moat-key-vault.json)"}
              </Label>
              <input
                id="recovery-file"
                type="file"
                accept=".json,application/json"
                className="text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
                onChange={(event) => void handleChooseFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : null}

          <InputField
            id="adopt-passphrase"
            type="password"
            label="Recovery passphrase"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="current-password"
          />

          <PinInputField
            id="adopt-device-pin"
            label={`PIN for this device (at least ${MIN_PIN_LENGTH} digits, this becomes the PIN you unlock with)`}
            value={devicePin}
            onChange={setDevicePin}
            autoComplete="new-password"
          />

          {error ? <ErrorNotice message={error} /> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isWorking}
              onClick={() => void handleAdopt(false)}
            >
              {isWorking ? "Opening..." : "Open with passphrase"}
            </Button>
            {canUsePasskey ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() => void handleAdopt(true)}
              >
                Use a passkey instead
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={resetAdoption}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {!isAdopting && error ? <ErrorNotice message={error} /> : null}
      {success ? <p className="text-xs text-muted-foreground">{success}</p> : null}

      <ConfirmDialog
        open={isConfirmingRemoval}
        onOpenChange={setIsConfirmingRemoval}
        title="Remove the recovery file?"
        description="Any sealed backup in Drive becomes unopenable on a new device. Backups made with a PIN are unaffected."
        confirmLabel="Remove it"
        destructive
        busy={isWorking}
        onConfirm={() => void handleRemoveRecoveryFile()}
      />
    </div>
  );
}
