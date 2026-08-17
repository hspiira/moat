/**
 * Keyset pagination for pull.
 *
 * A timestamp alone is not enough for a cursor: records written in the same
 * millisecond sort together, so a page boundary inside that group either drops
 * the rest of it (`>`) or replays it forever (`>=`). The cursor pairs
 * `updatedAt` with the entity key, which is unique, so boundaries are exact.
 *
 * Maps onto Postgres later as:
 *   WHERE (updated_at, entity_key) > ($1, $2) ORDER BY updated_at, entity_key
 */

export const DEFAULT_PULL_PAGE_SIZE = 500;
export const MAX_PULL_PAGE_SIZE = 2000;

const CURSOR_SEPARATOR = "|";

export type SyncPullCursor = {
  updatedAt: string;
  entityKey: string;
};

export function toEntityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function serializeCursor(cursor: SyncPullCursor): string {
  return `${cursor.updatedAt}${CURSOR_SEPARATOR}${cursor.entityKey}`;
}

/**
 * Also accepts a bare timestamp, which is what profiles stored before paging
 * existed. Those get an empty tiebreaker, making them inclusive of records at
 * exactly that instant. Re-applying an upsert is harmless; skipping one is not.
 */
export function parseCursor(since: string | undefined): SyncPullCursor | null {
  if (!since?.trim()) {
    return null;
  }

  const separatorIndex = since.indexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    return { updatedAt: since, entityKey: "" };
  }

  return {
    updatedAt: since.slice(0, separatorIndex),
    entityKey: since.slice(separatorIndex + CURSOR_SEPARATOR.length),
  };
}

export function compareByCursorOrder(left: SyncPullCursor, right: SyncPullCursor): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt < right.updatedAt ? -1 : 1;
  }
  if (left.entityKey === right.entityKey) {
    return 0;
  }
  return left.entityKey < right.entityKey ? -1 : 1;
}

export function isAfterCursor(candidate: SyncPullCursor, cursor: SyncPullCursor | null): boolean {
  return !cursor || compareByCursorOrder(candidate, cursor) > 0;
}

export function resolvePageSize(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_PULL_PAGE_SIZE;
  }
  return Math.min(MAX_PULL_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}
