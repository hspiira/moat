import type { StorageAdapter } from "@/lib/repositories/adapter";
import type { NativeStorageRecord } from "@/lib/native/storage-bridge";
import type { SqliteClient } from "@/lib/repositories/sqlite/client";
import type { StoreName } from "@/lib/repositories/store-names";

export function createSqliteAdapter(client: SqliteClient): StorageAdapter {
  return {
    deserialize<T>(_store: StoreName, raw: unknown): T {
      if (typeof raw !== "object" || raw === null) {
        throw new Error("Native storage returned a record that is not an object.");
      }
      return raw as T;
    },
    getById(store, id) {
      return client.getById<unknown>(store, id);
    },
    listAll(store) {
      return client.listAll<unknown>(store);
    },
    listByUser(store, userId) {
      return client.listByUser<unknown>(store, userId);
    },
    listByFields(store, filters) {
      return client.listByFields<unknown>(store, filters);
    },
    listByFieldPrefix(store, field, prefix, userId) {
      return client.listByFieldPrefix<unknown>(store, field, prefix, userId);
    },
    listByFieldIn(store, field, values, userId) {
      return client.listByFieldIn<unknown>(store, field, values, userId);
    },
    upsert<T extends { id: string }>(store: StoreName, entity: T): Promise<T> {
      return client.upsert(
        store,
        entity as unknown as NativeStorageRecord & { id: string },
      ) as unknown as Promise<T>;
    },
    remove(store, id) {
      return client.remove(store, id);
    },
    replaceAll<T extends { id: string }>(store: StoreName, records: T[]): Promise<T[]> {
      return client.replaceAll(
        store,
        records as unknown as Array<NativeStorageRecord & { id: string }>,
      ) as unknown as Promise<T[]>;
    },
  };
}
