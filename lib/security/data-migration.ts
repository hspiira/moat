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
import {
  getActiveRecordCryptoKey,
  setActiveRecordCryptoKey,
} from "@/lib/security/record-crypto";

/**
 * Encrypt every existing record with the given DEK. Call when turning
 * encryption on: reads current (plaintext) records, activates the key, then
 * rewrites them encrypted. Leaves the DEK active on success.
 *
 * On write failure the in-memory plaintext snapshot is written back so no
 * record is left encrypted under a key the caller is about to discard. If even
 * that rollback fails, the DEK stays active — it is the only key that can read
 * whatever was already rewritten. Either way the error is rethrown.
 */
export async function encryptAllRecordsWithDek(dek: CryptoKey): Promise<void> {
  const snapshot = await snapshotAllRecords(); // key inactive → plaintext read
  setActiveRecordCryptoKey(dek);
  try {
    await writeAllRecords(snapshot); // encrypts with the DEK
  } catch (error) {
    try {
      setActiveRecordCryptoKey(null);
      await writeAllRecords(snapshot); // roll back to plaintext from memory
    } catch {
      setActiveRecordCryptoKey(dek); // keep the readable-state key
    }
    throw error;
  }
}

/**
 * Decrypt every record back to plaintext. Call when turning encryption off:
 * reads with the active DEK, clears the key, then rewrites plaintext. Requires
 * the DEK to be active on entry.
 *
 * On write failure the DEK is restored as the active key so records still
 * encrypted at rest stay readable, and the error is rethrown — callers must
 * not proceed to discard key material.
 */
export async function decryptAllRecords(): Promise<void> {
  const dek = getActiveRecordCryptoKey();
  const snapshot = await snapshotAllRecords(); // active key → decrypted read
  setActiveRecordCryptoKey(null);
  try {
    await writeAllRecords(snapshot); // plaintext write
  } catch (error) {
    setActiveRecordCryptoKey(dek);
    throw error;
  }
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
