import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";
import { deriveRecordSubkey, getActiveRecordCryptoKey } from "@/lib/security/record-crypto";

const SYNC_PAYLOAD_INFO = "moat/sync-payload/v1";
const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;

export class SyncEncryptionError extends Error {}

type SealedPayload = {
  v: number;
  iv: string;
  ct: string;
};

let cachedKey: CryptoKey | null = null;
let cachedSource: CryptoKey | null = null;

export function canSealSyncPayloads(): boolean {
  return getActiveRecordCryptoKey() !== null;
}

async function payloadKey(): Promise<CryptoKey> {
  const source = getActiveRecordCryptoKey();
  if (!source) {
    throw new SyncEncryptionError(
      "Hosted sync needs a PIN. Records are encrypted before they leave this device.",
    );
  }

  if (cachedKey && cachedSource === source) {
    return cachedKey;
  }

  cachedKey = await deriveRecordSubkey(SYNC_PAYLOAD_INFO, { name: "AES-GCM", length: 256 }, [
    "encrypt",
    "decrypt",
  ]);
  cachedSource = source;
  return cachedKey;
}

export function isSealedSyncPayload(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Partial<SealedPayload>;
    return (
      typeof parsed?.v === "number" &&
      typeof parsed?.iv === "string" &&
      typeof parsed?.ct === "string"
    );
  } catch {
    return false;
  }
}

export async function sealSyncPayload(plaintext: string): Promise<string> {
  const key = await payloadKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const sealed: SealedPayload = {
    v: ENVELOPE_VERSION,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(sealed);
}

export async function openSyncPayload(sealed: string): Promise<string> {
  let envelope: SealedPayload;

  try {
    envelope = JSON.parse(sealed) as SealedPayload;
  } catch {
    throw new SyncEncryptionError("A synced record could not be read.");
  }

  if (
    typeof envelope?.v !== "number" ||
    typeof envelope?.iv !== "string" ||
    typeof envelope?.ct !== "string"
  ) {
    throw new SyncEncryptionError("A synced record arrived unencrypted and was refused.");
  }

  if (envelope.v !== ENVELOPE_VERSION) {
    throw new SyncEncryptionError(
      `A synced record uses format ${envelope.v}, which this version cannot read.`,
    );
  }

  const key = await payloadKey();

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ct),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new SyncEncryptionError("A synced record could not be decrypted with this device's key.");
  }
}
