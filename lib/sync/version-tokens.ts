import type { SyncPullRecord, SyncPushResult } from "@/lib/sync/types";
import type { SyncVersion } from "@/lib/types";

export function versionRecordId(userId: string, entityType: string, entityId: string): string {
  return `${userId}|${entityType}|${entityId}`;
}

// The server decides whether an edit was made against the version it holds, and
// it can only do that if the client sends the token it last saw. Without this the
// server falls back to comparing payloads, which calls every real edit a
// conflict, because a real edit is by definition a different payload.
export function buildVersionRecord(params: {
  userId: string;
  entityType: string;
  entityId: string;
  serverVersionToken: string;
  timestamp: string;
}): SyncVersion {
  return {
    id: versionRecordId(params.userId, params.entityType, params.entityId),
    userId: params.userId,
    entityType: params.entityType,
    entityId: params.entityId,
    serverVersionToken: params.serverVersionToken,
    updatedAt: params.timestamp,
  };
}

export function versionRecordsFromPull(params: {
  userId: string;
  records: SyncPullRecord[];
  timestamp: string;
}): SyncVersion[] {
  return params.records
    .filter((record) => Boolean(record.serverVersionToken))
    .map((record) =>
      buildVersionRecord({
        userId: params.userId,
        entityType: record.entityType,
        entityId: record.entityId,
        serverVersionToken: record.serverVersionToken,
        timestamp: params.timestamp,
      }),
    );
}

// A conflict returns the server's own record, and its token is the one to send
// next, or the same edit is rejected again for the same reason.
export function versionRecordsFromPush(params: {
  userId: string;
  results: SyncPushResult[];
  pushed: Array<{ outboxId: string; entityType: string; entityId: string }>;
  timestamp: string;
}): SyncVersion[] {
  const byOutboxId = new Map(params.pushed.map((item) => [item.outboxId, item]));

  return params.results.flatMap((result) => {
    const item = byOutboxId.get(result.outboxId);
    if (!item) return [];

    const token = result.serverRecord?.serverVersionToken ?? result.serverVersionToken;
    if (!token) return [];

    return [
      buildVersionRecord({
        userId: params.userId,
        entityType: item.entityType,
        entityId: item.entityId,
        serverVersionToken: token,
        timestamp: params.timestamp,
      }),
    ];
  });
}

export function tokenLookup(versions: SyncVersion[]): Map<string, string> {
  return new Map(
    versions.map((version) => [
      `${version.entityType}:${version.entityId}`,
      version.serverVersionToken,
    ]),
  );
}
