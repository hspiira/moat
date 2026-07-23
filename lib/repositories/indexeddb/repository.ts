import type { FieldFilter, FieldValue, StorageAdapter } from "@/lib/repositories/adapter";
import {
  getIndexedDbIndexName,
  openFinanceDatabase,
  type StoreName,
} from "@/lib/repositories/indexeddb/client";
import {
  decryptRecordFromStorage,
  encryptRecordForStorage,
  hasActiveRecordCryptoKey,
  indexQueryKey,
} from "@/lib/security/record-crypto";

async function getRaw(storeName: StoreName, id: string): Promise<unknown> {
  const database = await openFinanceDatabase();

  return new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(id);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read record ${id} from ${storeName}.`));
  });
}

export async function readStoreRaw(storeName: StoreName): Promise<unknown[]> {
  const database = await openFinanceDatabase();

  return new Promise<unknown[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read records from ${storeName}.`));
  });
}

async function readIndexRaw(
  storeName: StoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<unknown[]> {
  const database = await openFinanceDatabase();

  return new Promise<unknown[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index(indexName).getAll(query);

    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read indexed records from ${storeName}.`));
  });
}

export async function putRaw<T extends { id: string }>(storeName: StoreName, entity: T): Promise<T> {
  const database = await openFinanceDatabase();
  const storedEntity = await encryptRecordForStorage(storeName, entity);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).put(storedEntity);

    request.onsuccess = () => resolve(entity);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to write record to ${storeName}.`));
  });
}

async function removeRaw(storeName: StoreName, id: string): Promise<void> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to delete record ${id} from ${storeName}.`));
  });
}

async function readByUserIndex(
  storeName: StoreName,
  fields: string[],
  values: FieldValue[],
): Promise<unknown[]> {
  const indexName = getIndexedDbIndexName(storeName, fields);
  const query = await indexQueryKey(storeName, fields, values);
  return readIndexRaw(storeName, indexName, query);
}

/**
 * IndexedDB storage adapter: translates the semantic read operations into
 * index lookups (blinded when encryption is active) and applies the
 * record-encryption layer on writes. Record materialization and the
 * skip-a-bad-record policy live in the shared layer.
 */
export function createIndexedDbAdapter(): StorageAdapter {
  return {
    deserialize<T>(_store: StoreName, raw: unknown): Promise<T> {
      return decryptRecordFromStorage<T>(raw) as Promise<T>;
    },
    getById(store, id) {
      return getRaw(store, id);
    },
    listAll(store) {
      return readStoreRaw(store);
    },
    listByUser(store, userId) {
      return readByUserIndex(store, ["userId"], [userId]);
    },
    listByFields(store, filters: FieldFilter[]) {
      return readByUserIndex(
        store,
        filters.map((filter) => filter.field),
        filters.map((filter) => filter.value),
      );
    },
    listByFieldPrefix(store, field, prefix, userId) {
      const indexName = getIndexedDbIndexName(store, ["userId", field]);
      if (hasActiveRecordCryptoKey()) {
        // Blinded indexes store the exact hashed prefix (e.g. a transaction's
        // month), so match it exactly rather than by range.
        return indexQueryKey(store, ["userId", field], [userId, prefix]).then((query) =>
          readIndexRaw(store, indexName, query),
        );
      }
      // Plaintext mode: the field is an ordered ISO value, so range-match it.
      return readIndexRaw(
        store,
        indexName,
        IDBKeyRange.bound([userId, prefix], [userId, `${prefix}￿`]),
      );
    },
    async listByFieldIn(store, field, values, userId) {
      const indexName = getIndexedDbIndexName(store, ["userId", field]);
      const groups = await Promise.all(
        values.map(async (value) =>
          readIndexRaw(
            store,
            indexName,
            await indexQueryKey(store, ["userId", field], [userId, value]),
          ),
        ),
      );
      return groups.flat();
    },
    upsert(store, entity) {
      return putRaw(store, entity);
    },
    remove(store, id) {
      return removeRaw(store, id);
    },
    async replaceAll(store, records) {
      const database = await openFinanceDatabase();
      const storedRecords = await Promise.all(
        records.map((record) => encryptRecordForStorage(store, record)),
      );

      return new Promise<typeof records>((resolve, reject) => {
        const transaction = database.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        objectStore.clear();
        storedRecords.forEach((record) => objectStore.put(record));

        transaction.oncomplete = () => resolve(records);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error(`Unable to replace records in ${store}.`));
      });
    },
  };
}
