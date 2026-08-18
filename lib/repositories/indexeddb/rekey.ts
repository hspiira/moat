import { storeNames, type StoreName } from "@/lib/repositories/store-names";
import { createIndexedDbAdapter } from "@/lib/repositories/indexeddb/repository";
import { hydrateMany } from "@/lib/repositories/shared";

const ENCRYPTABLE_STORE_NAMES: StoreName[] = Object.values(storeNames).filter(
  (name): name is StoreName => name !== "meta",
);

export async function snapshotAllRecords(): Promise<Map<StoreName, unknown[]>> {
  const adapter = createIndexedDbAdapter();
  const snapshot = new Map<StoreName, unknown[]>();
  for (const storeName of ENCRYPTABLE_STORE_NAMES) {
    const raw = await adapter.listAll(storeName);
    snapshot.set(storeName, await hydrateMany<unknown>(adapter, storeName, raw));
  }
  return snapshot;
}

export async function writeAllRecords(snapshot: Map<StoreName, unknown[]>): Promise<void> {
  const adapter = createIndexedDbAdapter();
  for (const [storeName, records] of snapshot) {
    await adapter.replaceAll(storeName, records as { id: string }[]);
  }
}
