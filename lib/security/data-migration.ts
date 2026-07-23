/**
 * Whole-database re-keying used when the user enables, disables, or changes
 * local encryption. Reads every record with the current key, switches the
 * active key, then writes every record back — so nothing is left encrypted
 * under a key that no longer exists (which would be data loss) and nothing is
 * left in plaintext once encryption is on.
 *
 * Web/IndexedDB only. The native SQLite bridge handles its own at-rest storage.
 */

import {
  snapshotAllRecords,
  writeAllRecords,
} from "@/lib/repositories/indexeddb/rekey";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";

/**
 * Encrypt every existing record with the given DEK. Call when turning
 * encryption on: reads current (plaintext) records, activates the key, then
 * rewrites them encrypted. Leaves the DEK active on success.
 */
export async function encryptAllRecordsWithDek(dek: CryptoKey): Promise<void> {
  const snapshot = await snapshotAllRecords(); // key inactive → plaintext read
  setActiveRecordCryptoKey(dek);
  try {
    await writeAllRecords(snapshot); // encrypts with the DEK
  } catch (error) {
    // Roll back the key so we don't half-encrypt behind an active key.
    setActiveRecordCryptoKey(null);
    throw error;
  }
}

/**
 * Decrypt every record back to plaintext. Call when turning encryption off:
 * reads with the active DEK, clears the key, then rewrites plaintext. Requires
 * the DEK to be active on entry.
 */
export async function decryptAllRecords(): Promise<void> {
  const snapshot = await snapshotAllRecords(); // active key → decrypted read
  setActiveRecordCryptoKey(null);
  await writeAllRecords(snapshot); // plaintext write
}

/**
 * Re-encrypt every record in place with the currently active DEK. Contents are
 * unchanged, but index metadata is re-derived — used to migrate records that
 * were written with plaintext index fields (envelope v1) to keyed blind indexes
 * (v2). Requires the DEK to be active; the key stays active throughout, so a
 * partial failure leaves records readable and the migration simply re-runs.
 */
export async function reblindAllRecords(): Promise<void> {
  const snapshot = await snapshotAllRecords(); // active key → decrypted read
  await writeAllRecords(snapshot); // re-encrypt → v2 blinded metadata
}
