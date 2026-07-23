import { storeNames, type StoreName } from "@/lib/repositories/store-names";
import { createIndexedDbAdapter } from "@/lib/repositories/indexeddb/repository";
import { hydrateMany } from "@/lib/repositories/shared";

/**
 * Whole-database re-keying primitives for the IndexedDB backend. Used when the
 * user enables, disables, or changes local encryption: snapshot every record
 * with the current key, switch the active key, then write everything back so
 * nothing is left under a key that no longer exists. The native SQLite bridge
 * handles its own at-rest encryption and does not use these.
 */

/**
 * Every store that holds encryptable user data (everything except `meta`,
 * which carries schema-version bookkeeping and must stay plaintext for
 * migrations).
 */
const ENCRYPTABLE_STORE_NAMES: StoreName[] = Object.values(storeNames).filter(
  (name): name is StoreName => name !== "meta",
);

/**
 * Read and decrypt every record in every encryptable store using the current
 * active key, captured in memory so the key can be switched between snapshot
 * and write-back without losing data. Unreadable records are skipped.
 */
export async function snapshotAllRecords(): Promise<Map<StoreName, unknown[]>> {
  const adapter = createIndexedDbAdapter();
  const snapshot = new Map<StoreName, unknown[]>();
  for (const storeName of ENCRYPTABLE_STORE_NAMES) {
    const raw = await adapter.listAll(storeName);
    snapshot.set(storeName, await hydrateMany<unknown>(adapter, storeName, raw));
  }
  return snapshot;
}

/**
 * Write a snapshot back, encrypting with whatever key is currently active
 * (or storing plaintext when none is). Pair with snapshotAllRecords to re-key.
 */
export async function writeAllRecords(snapshot: Map<StoreName, unknown[]>): Promise<void> {
  const adapter = createIndexedDbAdapter();
  for (const [storeName, records] of snapshot) {
    // One replaceAll per store: the store is rewritten in a single IndexedDB
    // transaction, so a failure can't leave it part-old-key, part-new-key.
    await adapter.replaceAll(storeName, records as { id: string }[]);
  }
}
