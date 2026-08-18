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
