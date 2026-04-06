import type { StoreName } from "@/lib/repositories/indexeddb/client";
import {
  executeNativeStorageCommand,
  getNativeStorageBridge,
  hasNativeStorageBridge,
  type NativeStorageBridge,
  type NativeStorageRecord,
} from "@/lib/native/storage-bridge";

export type SqliteClient = {
  getById<T>(store: StoreName, id: string): Promise<T | null>;
  listAll<T>(store: StoreName): Promise<T[]>;
  listByUser<T>(store: StoreName, userId: string): Promise<T[]>;
  listByField<T>(
    store: StoreName,
    field: string,
    value: string | number | boolean,
  ): Promise<T[]>;
  listByFieldPrefix<T>(
    store: StoreName,
    field: string,
    prefix: string,
    userId?: string,
  ): Promise<T[]>;
  listByFields<T>(
    store: StoreName,
    filters: Array<{
      field: string;
      value: string | number | boolean;
    }>,
  ): Promise<T[]>;
  listByFieldIn<T>(
    store: StoreName,
    field: string,
    values: Array<string | number | boolean>,
    userId?: string,
  ): Promise<T[]>;
  upsert<T extends NativeStorageRecord>(store: StoreName, record: T): Promise<T>;
  remove(store: StoreName, id: string): Promise<void>;
  replaceAll<T extends NativeStorageRecord>(store: StoreName, records: T[]): Promise<T[]>;
};

export function createSqliteClient(bridge: NativeStorageBridge = getNativeStorageBridge() ?? {}) {
  const run = <T>(command: Parameters<typeof executeNativeStorageCommand>[0]) =>
    Promise.resolve(executeNativeStorageCommand<T>(command, bridge));

  const client: SqliteClient = {
    async getById(store, id) {
      return run({ action: "getById", store, id });
    },
    async listAll(store) {
      return run({ action: "listAll", store });
    },
    async listByUser(store, userId) {
      return run({ action: "listByUser", store, userId });
    },
    async listByField(store, field, value) {
      return run({ action: "listByField", store, field, value });
    },
    async listByFieldPrefix(store, field, prefix, userId) {
      return run({ action: "listByFieldPrefix", store, field, prefix, userId });
    },
    async listByFields(store, filters) {
      return run({ action: "listByFields", store, filters });
    },
    async listByFieldIn(store, field, values, userId) {
      return run({ action: "listByFieldIn", store, field, values, userId });
    },
    async upsert(store, record) {
      return run({ action: "upsert", store, record });
    },
    async remove(store, id) {
      await run({ action: "remove", store, id });
    },
    async replaceAll(store, records) {
      return run({ action: "replaceAll", store, records });
    },
  };

  return client;
}

export function isSqliteStorageAvailable(bridge?: NativeStorageBridge): boolean {
  if (bridge) {
    return !!bridge.executeStorageCommand && (bridge.isStorageAvailable?.() ?? true);
  }

  return hasNativeStorageBridge();
}
