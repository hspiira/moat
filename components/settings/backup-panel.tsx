"use client";

import { useRef, useState } from "react";

import { collectFullExport, downloadBlob } from "@/lib/security/data-export";
import { encryptWithPin, decryptWithPin, type EncryptedPayload } from "@/lib/security/pin-crypto";
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

type BackupMode = "idle" | "backup" | "restore";

export function BackupPanel() {
  const [mode, setMode] = useState<BackupMode>("idle");
  const [backupPin, setBackupPin] = useState("");
  const [restorePin, setRestorePin] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMode("idle");
    setBackupPin("");
    setRestorePin("");
    setError(null);
    setIsWorking(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

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
      const data = await collectFullExport();
      const encrypted = await encryptWithPin(data, backupPin);
      const json = JSON.stringify(encrypted);
      const blob = new Blob([json], { type: "application/octet-stream" });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `moat-backup-${date}.enc`);
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
      const payload = JSON.parse(text) as EncryptedPayload;
      const data = await decryptWithPin(payload, restorePin);

      // Write each store back via repositories
      const { createIndexedDbRepositories } = await import("@/lib/repositories/indexeddb");
      const repositories = createIndexedDbRepositories();
      const exportData = data as Record<string, unknown>;

      if (exportData.userProfile) {
        await repositories.userProfile.save(exportData.userProfile as Parameters<typeof repositories.userProfile.save>[0]);
      }

      const arrayStores = [
        { key: "accounts", repo: repositories.accounts },
        { key: "categories", repo: repositories.categories },
        { key: "goals", repo: repositories.goals },
        { key: "budgets", repo: repositories.budgets },
        { key: "imports", repo: repositories.imports },
      ] as const;

      for (const { key, repo } of arrayStores) {
        const items = exportData[key] as { id: string }[] | undefined;
        if (Array.isArray(items)) {
          await Promise.all(items.map((item) => (repo as { upsert: (i: typeof item) => Promise<unknown> }).upsert(item)));
        }
      }

      if (Array.isArray(exportData.transactions)) {
        await Promise.all(
          (exportData.transactions as Parameters<typeof repositories.transactions.upsert>[0][]).map(
            (t) => repositories.transactions.upsert(t),
          ),
        );
      }

      if (Array.isArray(exportData.investmentProfiles) && exportData.investmentProfiles.length > 0) {
        await repositories.investmentProfiles.save(
          exportData.investmentProfiles[0] as Parameters<typeof repositories.investmentProfiles.save>[0],
        );
      }

      setSuccess("Backup restored successfully. Reload the app to see your data.");
      reset();
    } catch {
      setError("Could not restore backup. Check that you selected the correct file and PIN.");
    } finally {
      setIsWorking(false);
    }
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
        {success ? (
          <p className="text-xs text-muted-foreground">{success}</p>
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
      </CardContent>
    </Card>
  );
}
