import type { StoreName } from "@/lib/repositories/store-names";

export type FieldValue = string | number | boolean;

export type FieldFilter = {
  field: string;
  value: FieldValue;
};

export interface StorageAdapter {
  deserialize<T>(store: StoreName, raw: unknown): T | Promise<T>;

  getById(store: StoreName, id: string): Promise<unknown | null>;
  listAll(store: StoreName): Promise<unknown[]>;
  listByUser(store: StoreName, userId: string): Promise<unknown[]>;

  listByFields(store: StoreName, filters: FieldFilter[]): Promise<unknown[]>;

  listByFieldPrefix(
    store: StoreName,
    field: string,
    prefix: string,
    userId: string,
  ): Promise<unknown[]>;

  listByFieldIn(
    store: StoreName,
    field: string,
    values: FieldValue[],
    userId: string,
  ): Promise<unknown[]>;

  upsert<T extends { id: string }>(store: StoreName, entity: T): Promise<T>;
  remove(store: StoreName, id: string): Promise<void>;
  replaceAll<T extends { id: string }>(store: StoreName, records: T[]): Promise<T[]>;
}
