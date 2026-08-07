import type { StoreName } from "@/lib/repositories/store-names";
import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";

/**
 * Envelope versions:
 *   1 — record contents encrypted, but index fields (userId, month, …) stored
 *       as plaintext so IndexedDB indexes worked. Leaked queryable metadata.
 *   2 — index fields are keyed HMAC "blind indexes" derived from the DEK, so
 *       nothing sensitive is stored in plaintext at rest. Queries hash their
 *       arguments the same way. Records written at v1 are transparently
 *       re-blinded on unlock (see reblindAllRecords).
 */
const RECORD_ENVELOPE_VERSION = 2;
const IV_BYTES = 12;

// NUL is the domain separator between a blind index's namespace and value: it
// can never appear in either side, so "a"+"bc" and "ab"+"c" hash differently.
// Built with fromCharCode instead of an escape or raw byte so the file stays
// reviewable text and no tooling can silently normalize the separator.
// Changing this value would invalidate every blind index already on disk.
const BLIND_INDEX_SEPARATOR = String.fromCharCode(0);

type RecordMetadata = Record<string, unknown>;

export type EncryptedRecordEnvelope = RecordMetadata & {
  id: string;
  __moatEncrypted: true;
  __moatEnvelopeVersion: number;
  iv: string;
  ciphertext: string;
};

let activeRecordKey: CryptoKey | null = null;
// Blind-index HMAC key, derived on demand from the active DEK. Cached against
// the DEK it was derived from so it invalidates whenever the DEK changes.
let activeBlindKey: CryptoKey | null = null;
let blindKeySourceDek: CryptoKey | null = null;

/**
 * The plaintext index fields each store needs to stay queryable. Values are
 * stringified and blinded; for transactions the stored key is the month
 * (`occurredOn` truncated to `YYYY-MM`) so month lookups remain exact.
 */
const metadataFields: Partial<Record<StoreName, (entity: Record<string, unknown>) => Record<string, string>>> = {
  accounts: (entity) => ({ userId: String(entity.userId) }),
  transactions: (entity) => ({
    userId: String(entity.userId),
    occurredOn: monthOf(entity.occurredOn),
  }),
  captureEnvelopes: (entity) => ({ userId: String(entity.userId) }),
  captureReviewItems: (entity) => ({ userId: String(entity.userId) }),
  correctionLogs: (entity) => ({ userId: String(entity.userId) }),
  transactionRules: (entity) => ({ userId: String(entity.userId) }),
  recurringObligations: (entity) => ({ userId: String(entity.userId) }),
  monthCloses: (entity) => ({ userId: String(entity.userId), period: String(entity.period) }),
  categories: (entity) => ({ userId: String(entity.userId), isDefault: String(entity.isDefault) }),
  goals: (entity) => ({ userId: String(entity.userId) }),
  budgets: (entity) => ({ userId: String(entity.userId), month: String(entity.month) }),
  investmentProfiles: (entity) => ({ userId: String(entity.userId) }),
  imports: (entity) => ({ userId: String(entity.userId) }),
  syncProfiles: (entity) => ({ userId: String(entity.userId) }),
  syncOutbox: (entity) => ({ userId: String(entity.userId), status: String(entity.status) }),
  items: (entity) => ({ userId: String(entity.userId) }),
  plannedPurchases: (entity) => ({ userId: String(entity.userId) }),
  transactionLineItems: (entity) => ({ userId: String(entity.userId) }),
};

/** Truncate an ISO date (`YYYY-MM-DD…`) to its month (`YYYY-MM`). */
function monthOf(occurredOn: unknown): string {
  return String(occurredOn).slice(0, 7);
}

/**
 * Derive (and cache) the blind-index HMAC key from the active DEK. The DEK is
 * extractable by design so it can be re-wrapped; we reuse it here as HKDF input
 * to derive a separate, single-purpose signing key bound to a fixed context.
 */
async function ensureBlindIndexKey(): Promise<CryptoKey> {
  if (activeBlindKey && blindKeySourceDek === activeRecordKey) {
    return activeBlindKey;
  }
  if (!activeRecordKey) {
    throw new Error("Cannot compute a blind index without an active key.");
  }
  const rawDek = await crypto.subtle.exportKey("raw", activeRecordKey);
  const hkdfBase = await crypto.subtle.importKey("raw", rawDek, "HKDF", false, ["deriveKey"]);
  activeBlindKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode("moat/blind-index/v1"),
    },
    hkdfBase,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  blindKeySourceDek = activeRecordKey;
  return activeBlindKey;
}

/**
 * Deterministic keyed hash of an index value, namespaced per store+field so
 * the same literal in different columns produces different hashes. Requires an
 * active key; only ever called on the encrypted write/query path.
 */
export async function blindIndexValue(namespace: string, value: string): Promise<string> {
  const key = await ensureBlindIndexKey();
  const message = new TextEncoder().encode(`${namespace}${BLIND_INDEX_SEPARATOR}${value}`);
  const signature = await crypto.subtle.sign("HMAC", key, message);
  return bytesToBase64(new Uint8Array(signature));
}

/**
 * The IndexedDB index key for a query: blinded when encryption is active, raw
 * otherwise (plaintext-mode users have no key and store raw index values).
 * `fields`/`values` are positional and align with the index's keyPath.
 */
export async function indexQueryKey(
  storeName: StoreName,
  fields: string[],
  values: Array<string | number | boolean>,
): Promise<IDBValidKey> {
  if (!activeRecordKey) {
    return values.length === 1 ? (values[0] as IDBValidKey) : (values as IDBValidKey);
  }
  const blinded = await Promise.all(
    fields.map((field, i) => blindIndexValue(`${storeName}:${field}`, String(values[i]))),
  );
  return blinded.length === 1 ? blinded[0] : blinded;
}

/** Build the blinded index metadata stored alongside the ciphertext. */
async function getRecordMetadata(
  storeName: StoreName,
  entity: Record<string, unknown>,
): Promise<RecordMetadata> {
  const raw = metadataFields[storeName]?.(entity) ?? {};
  const metadata: RecordMetadata = {};
  for (const [field, value] of Object.entries(raw)) {
    metadata[field] = await blindIndexValue(`${storeName}:${field}`, value);
  }
  return metadata;
}

export function setActiveRecordCryptoKey(key: CryptoKey | null) {
  activeRecordKey = key;
  if (key !== blindKeySourceDek) {
    activeBlindKey = null;
    blindKeySourceDek = null;
  }
}

export function hasActiveRecordCryptoKey() {
  return activeRecordKey !== null;
}

/** The active Data Encryption Key, for re-wrapping when unlock methods change. */
export function getActiveRecordCryptoKey(): CryptoKey | null {
  return activeRecordKey;
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
    ...(await getRecordMetadata(storeName, entity as Record<string, unknown>)),
    __moatEncrypted: true,
    __moatEnvelopeVersion: RECORD_ENVELOPE_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
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
    { name: "AES-GCM", iv: base64ToBytes(value.iv) },
    activeRecordKey,
    base64ToBytes(value.ciphertext),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
