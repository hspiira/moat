import {
  collectFullExport,
  restoreFullExport,
  type FullExport,
} from "@/lib/security/data-export";
import {
  decryptWithPin,
  encryptWithPin,
  type EncryptedPayload,
} from "@/lib/security/pin-crypto";

const BACKUP_FILENAME_PREFIX = "moat-backup-";
const BACKUP_FILENAME_SUFFIX = ".enc";

export function buildBackupFilename(exportedAt = new Date()): string {
  const iso = exportedAt.toISOString().replaceAll(":", "-");
  return `${BACKUP_FILENAME_PREFIX}${iso}${BACKUP_FILENAME_SUFFIX}`;
}

export function isBackupFilename(name: string): boolean {
  return name.startsWith(BACKUP_FILENAME_PREFIX) && name.endsWith(BACKUP_FILENAME_SUFFIX);
}

export async function createEncryptedBackupPayload(pin: string): Promise<EncryptedPayload> {
  const data = await collectFullExport();
  return encryptWithPin(data, pin);
}

export async function createEncryptedBackupBlob(params: {
  pin: string;
  exportedAt?: Date;
}): Promise<{ blob: Blob; filename: string }> {
  const payload = await createEncryptedBackupPayload(params.pin);
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/octet-stream",
  });

  return {
    blob,
    filename: buildBackupFilename(params.exportedAt),
  };
}

export async function restoreEncryptedBackupPayload(params: {
  payloadText: string;
  pin: string;
}): Promise<void> {
  const payload = JSON.parse(params.payloadText) as EncryptedPayload;
  const data = await decryptWithPin<FullExport>(payload, params.pin);
  await restoreFullExport(data);
}
