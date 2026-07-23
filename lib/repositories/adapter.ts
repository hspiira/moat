import type { StoreName } from "@/lib/repositories/store-names";

export type FieldValue = string | number | boolean;

export type FieldFilter = {
  field: string;
  value: FieldValue;
};

/**
 * The minimal storage primitives every repository is expressed against. Read
 * methods return records in their *stored* form (an IndexedDB envelope may be
 * encrypted; a SQLite row is a plain object) and the shared layer materializes
 * them via `deserialize`, skipping any that fail — so the fault-tolerance
 * policy lives once in the shared layer and both backends inherit it.
 *
 * Where the backends query differently (IndexedDB indexes vs SQLite field
 * filters) the interface names the semantic operation and each adapter
 * implements it its own way.
 */
export interface StorageAdapter {
  /**
   * Turn a stored record back into a domain object. May throw for corrupt,
   * locked, or otherwise unreadable data; the shared read path catches, warns,
   * and skips the record rather than failing the whole read.
   */
  deserialize<T>(store: StoreName, raw: unknown): T | Promise<T>;

  getById(store: StoreName, id: string): Promise<unknown | null>;
  listAll(store: StoreName): Promise<unknown[]>;
  listByUser(store: StoreName, userId: string): Promise<unknown[]>;

  /**
   * Records whose fields all equal the given values.
   *
   * IndexedDB precondition: a compound index whose key path is exactly the
   * filter fields, in order, must already exist — the adapter resolves it via
   * `getIndexedDbIndexName` and THROWS if none matches. SQLite filters
   * arbitrary fields. When adding a new query, declare the matching index in
   * `indexeddb/client.ts` (`storeIndexes`) first.
   */
  listByFields(store: StoreName, filters: FieldFilter[]): Promise<unknown[]>;

  /**
   * A user's records whose string `field` starts with `prefix`.
   *
   * IndexedDB precondition: a compound `[userId, field]` index must already
   * exist in `indexeddb/client.ts` (`storeIndexes`) or the adapter throws.
   * Note also that in encrypted mode the blinded index stores an exact hash
   * (e.g. a transaction's month), so `prefix` must equal the value the write
   * path blinds — true prefix matching only happens in plaintext mode.
   */
  listByFieldPrefix(
    store: StoreName,
    field: string,
    prefix: string,
    userId: string,
  ): Promise<unknown[]>;

  /**
   * A user's records whose `field` equals any of `values`. Same IndexedDB
   * precondition as `listByFieldPrefix`: a `[userId, field]` compound index
   * must exist.
   */
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
