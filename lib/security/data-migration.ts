import {
  snapshotAllRecords,
  writeAllRecords,
} from "@/lib/repositories/indexeddb/rekey";
import {
  getActiveRecordCryptoKey,
  setActiveRecordCryptoKey,
} from "@/lib/security/record-crypto";

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

export async function reblindAllRecords(): Promise<void> {
  const snapshot = await snapshotAllRecords(); // active key → decrypted read
  await writeAllRecords(snapshot); // re-encrypt → v2 blinded metadata
}
