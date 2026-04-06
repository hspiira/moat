import type { StoreName } from "@/lib/repositories/indexeddb/client";

const RECORD_ENVELOPE_VERSION = 1;
const IV_BYTES = 12;

type RecordMetadata = Record<string, unknown>;

export type EncryptedRecordEnvelope = RecordMetadata & {
  id: string;
  __moatEncrypted: true;
  __moatEnvelopeVersion: number;
  iv: string;
  ciphertext: string;
};

let activeRecordKey: CryptoKey | null = null;

const metadataExtractors: Partial<Record<StoreName, (entity: Record<string, unknown>) => RecordMetadata>> = {
  accounts: (entity) => ({ userId: entity.userId }),
  transactions: (entity) => ({ userId: entity.userId, occurredOn: entity.occurredOn }),
  captureEnvelopes: (entity) => ({ userId: entity.userId }),
  captureReviewItems: (entity) => ({ userId: entity.userId }),
  correctionLogs: (entity) => ({ userId: entity.userId }),
  transactionRules: (entity) => ({ userId: entity.userId }),
  recurringObligations: (entity) => ({ userId: entity.userId }),
  monthCloses: (entity) => ({ userId: entity.userId, period: entity.period }),
  categories: (entity) => ({ userId: entity.userId, isDefault: entity.isDefault }),
  goals: (entity) => ({ userId: entity.userId }),
  budgets: (entity) => ({ userId: entity.userId, month: entity.month }),
  investmentProfiles: (entity) => ({ userId: entity.userId }),
  imports: (entity) => ({ userId: entity.userId }),
  syncProfiles: (entity) => ({ userId: entity.userId }),
  syncOutbox: (entity) => ({ userId: entity.userId, status: entity.status }),
};

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function getRecordMetadata(storeName: StoreName, entity: Record<string, unknown>): RecordMetadata {
  const extractor = metadataExtractors[storeName];
  return extractor ? extractor(entity) : {};
}

export function setActiveRecordCryptoKey(key: CryptoKey | null) {
  activeRecordKey = key;
}

export function hasActiveRecordCryptoKey() {
  return activeRecordKey !== null;
}

export function isEncryptedRecordEnvelope(value: unknown): value is EncryptedRecordEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "__moatEncrypted" in value &&
    (value as { __moatEncrypted?: unknown }).__moatEncrypted === true
  );
}

export async function encryptRecordForStorage<T extends { id: string }>(
  storeName: StoreName,
  entity: T,
): Promise<T | EncryptedRecordEnvelope> {
  if (!activeRecordKey) {
    return entity;
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(entity));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    activeRecordKey,
    plaintext,
  );

  return {
    id: entity.id,
    ...getRecordMetadata(storeName, entity as Record<string, unknown>),
    __moatEncrypted: true,
    __moatEnvelopeVersion: RECORD_ENVELOPE_VERSION,
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  };
}

export async function decryptRecordFromStorage<T>(
  value: unknown,
): Promise<T | null> {
  if (value == null) {
    return null;
  }

  if (!isEncryptedRecordEnvelope(value)) {
    return value as T;
  }

  if (!activeRecordKey) {
    throw new Error("Moat is locked. Unlock with your PIN to access encrypted local data.");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(value.iv) },
    activeRecordKey,
    base64ToBuffer(value.ciphertext),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

