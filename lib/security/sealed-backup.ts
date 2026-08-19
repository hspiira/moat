import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";
import {
  collectFullExport,
  restoreFullExport,
  type FullExport,
} from "@/lib/security/data-export";

const SEALED_BACKUP_INFO = "moat/backup/v1";
const SEALED_FILENAME_PREFIX = "moat-sealed-";
const SEALED_FILENAME_SUFFIX = ".enc";
const IV_BYTES = 12;

export const SEALED_BACKUP_FORMAT = "moat-sealed-backup";
export const SEALED_BACKUP_VERSION = 1;

export type SealedBackupPayload = {
  format: typeof SEALED_BACKUP_FORMAT;
  version: number;
  iv: string;
  ciphertext: string;
};

export class SealedBackupError extends Error {}

export function buildSealedBackupFilename(exportedAt = new Date()): string {
  const iso = exportedAt.toISOString().replaceAll(":", "-");
  return `${SEALED_FILENAME_PREFIX}${iso}${SEALED_FILENAME_SUFFIX}`;
}

export function isSealedBackupFilename(name: string): boolean {
  return name.startsWith(SEALED_FILENAME_PREFIX) && name.endsWith(SEALED_FILENAME_SUFFIX);
}

// Sealed to a subkey of the device key rather than to a PIN, which is what lets
// a backup be written with nobody watching and opened on another device with
// nothing but the key vault.
async function deriveBackupKey(dek: CryptoKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.exportKey("raw", dek);
  const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(SEALED_BACKUP_INFO),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealBackup(params: {
  data: FullExport;
  dek: CryptoKey;
}): Promise<SealedBackupPayload> {
  const key = await deriveBackupKey(params.dek);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(params.data)),
  );

  return {
    format: SEALED_BACKUP_FORMAT,
    version: SEALED_BACKUP_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function openSealedBackup(params: {
  payload: SealedBackupPayload;
  dek: CryptoKey;
}): Promise<FullExport> {
  if (params.payload.version !== SEALED_BACKUP_VERSION) {
    throw new SealedBackupError(
      `That backup uses format ${params.payload.version}, which this version cannot read.`,
    );
  }

  const key = await deriveBackupKey(params.dek);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(params.payload.iv) },
      key,
      base64ToBytes(params.payload.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as FullExport;
  } catch {
    throw new SealedBackupError("That backup was not sealed with this key.");
  }
}

export async function createSealedBackupBlob(params: {
  dek: CryptoKey;
  exportedAt?: Date;
}): Promise<{ blob: Blob; filename: string }> {
  const payload = await sealBackup({ data: await collectFullExport(), dek: params.dek });

  return {
    blob: new Blob([JSON.stringify(payload)], { type: "application/octet-stream" }),
    filename: buildSealedBackupFilename(params.exportedAt),
  };
}

export async function restoreSealedBackup(params: {
  payload: SealedBackupPayload;
  dek: CryptoKey;
}): Promise<FullExport> {
  const data = await openSealedBackup(params);
  await restoreFullExport(data);
  return data;
}
