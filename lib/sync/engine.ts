import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";
import type { SyncPullRecord, SyncPushResult, SyncRunSummary } from "@/lib/sync/types";

import {
  DEFAULT_PULL_PAGE_SIZE,
  compareByCursorOrder,
  serializeCursor,
  toEntityKey,
} from "@/lib/sync/cursor";
import { applyPulledRecord, getConflictStrategy } from "@/lib/sync/entity-sync";
import { runWithSyncMutationSuppressed } from "@/lib/sync/mutation-scope";
import { canSealSyncPayloads, openSyncPayload } from "@/lib/sync/payload-crypto";
import { createSyncPushRequest, pullSyncBatch, pushSyncBatch } from "@/lib/sync/transport";

const MAX_PULL_PAGES = 1000;
const PUSH_BATCH_SIZE = 200;

function withOutboxUpdate(
  item: SyncOutboxItem,
  patch: Partial<SyncOutboxItem>,
): SyncOutboxItem {
  return {
    ...item,
    ...patch,
    attempts: item.attempts + 1,
    updatedAt: new Date().toISOString(),
  };
}

async function openServerRecord(record: SyncPullRecord): Promise<SyncPullRecord> {
  return openPulledRecord(record);
}

async function mapResultForItem(
  item: SyncOutboxItem,
  result?: SyncPushResult,
): Promise<SyncOutboxItem> {
  if (!result) {
    return withOutboxUpdate(item, {
      status: "failed",
      lastError: "Sync response did not include this outbox item.",
    });
  }

  if (result.status === "conflict") {
    const serverRecord = result.serverRecord
      ? await openServerRecord(result.serverRecord)
      : undefined;

    return withOutboxUpdate(item, {
      status: "conflict",
      lastError: result.error,
      conflictPayload: serverRecord ? JSON.stringify(serverRecord) : undefined,
    });
  }

  return withOutboxUpdate(item, {
    status: result.status === "synced" ? "synced" : "failed",
    lastError: result.error,
    conflictPayload: undefined,
  });
}

async function openPulledRecord(record: SyncPullRecord): Promise<SyncPullRecord> {
  if (record.payload === null) {
    return record;
  }
  return { ...record, payload: await openSyncPayload(record.payload) };
}

function lastCursorOf(records: SyncPullRecord[]): string | undefined {
  const positions = records.map((record) => ({
    updatedAt: record.updatedAt,
    entityKey: toEntityKey(record.entityType, record.entityId),
  }));
  const last = positions.sort(compareByCursorOrder).at(-1);
  return last ? serializeCursor(last) : undefined;
}

async function pullAllPages(params: {
  repositories: RepositoryBundle;
  profile: SyncProfile;
  conflictedEntityKeys: Set<string>;
}): Promise<{ profile: SyncProfile; syncedAt?: string; pulled: number }> {
  let profile = params.profile;
  let since = profile.lastPulledAt ?? profile.lastSyncedAt;
  let syncedAt: string | undefined;
  let pulled = 0;

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const response = await pullSyncBatch({
      endpoint: profile.postgresSyncUrl as string,
      authToken: profile.syncAuthToken,
      request: { userId: profile.userId, since, limit: DEFAULT_PULL_PAGE_SIZE },
    });

    await applyPulledRecords({
      repositories: params.repositories,
      records: await Promise.all(response.records.map(openPulledRecord)),
      conflictedEntityKeys: params.conflictedEntityKeys,
    });

    pulled += response.records.length;
    syncedAt = response.syncedAt;

    const nextSince = response.nextSince ?? lastCursorOf(response.records) ?? since;
    const cursorMoved = nextSince !== since;
    since = nextSince;

    if (cursorMoved) {
      profile = await params.repositories.syncProfiles.save({
        ...profile,
        lastPulledAt: since,
        updatedAt: new Date().toISOString(),
      });
    }

    if (!response.hasMore || !cursorMoved) {
      break;
    }
  }

  return { profile, syncedAt, pulled };
}

async function applyPulledRecords(params: {
  repositories: RepositoryBundle;
  records: SyncPullRecord[];
  conflictedEntityKeys: Set<string>;
}) {
  for (const record of params.records) {
    const entityKey = `${record.entityType}:${record.entityId}`;
    if (
      params.conflictedEntityKeys.has(entityKey) &&
      getConflictStrategy(record.entityType) === "manual_review"
    ) {
      continue;
    }

    await runWithSyncMutationSuppressed(async () => {
      await applyPulledRecord(params.repositories, record);
    });
  }
}

export async function runHostedSync(params: {
  repositories: RepositoryBundle;
  profile: SyncProfile;
  isOnline?: boolean;
  platform?: "web" | "android" | "ios";
}): Promise<SyncRunSummary> {
  if (!params.profile.hostedSyncEnabled || params.profile.mode !== "hosted_opt_in") {
    return { attempted: 0, synced: 0, failed: 0, conflicts: 0, error: "Hosted sync is not enabled." };
  }

  if (!params.profile.postgresSyncUrl?.trim()) {
    return { attempted: 0, synced: 0, failed: 0, conflicts: 0, error: "No sync endpoint is configured." };
  }

  if (params.isOnline === false) {
    return { attempted: 0, synced: 0, failed: 0, conflicts: 0, error: "Device is offline." };
  }

  if (!canSealSyncPayloads()) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
      error: "Hosted sync needs a PIN. Records are encrypted before they leave this device.",
    };
  }

  const pendingItems = await params.repositories.syncOutbox.listPendingByUser(params.profile.userId);

  await Promise.all(
    pendingItems.map((item) =>
      params.repositories.syncOutbox.upsert({
        ...item,
        status: "syncing",
        updatedAt: new Date().toISOString(),
      }),
    ),
  );

  try {
    let syncedCount = 0;
    let failedCount = 0;
    let conflictCount = 0;
    let pushedAt: string | undefined;
    const conflictedEntityKeys = new Set<string>();

    for (let start = 0; start < pendingItems.length; start += PUSH_BATCH_SIZE) {
      const batch = pendingItems.slice(start, start + PUSH_BATCH_SIZE);

      const response = await pushSyncBatch({
        endpoint: params.profile.postgresSyncUrl,
        request: await createSyncPushRequest({
          userId: params.profile.userId,
          items: batch,
          platform: params.platform,
          deviceId: params.profile.deviceId,
        }),
        authToken: params.profile.syncAuthToken,
      });

      const nextItems = await Promise.all(
        batch.map((item) =>
          mapResultForItem(
            item,
            response.results.find((result) => result.outboxId === item.id),
          ),
        ),
      );

      await Promise.all(nextItems.map((item) => params.repositories.syncOutbox.upsert(item)));

      syncedCount += nextItems.filter((item) => item.status === "synced").length;
      failedCount += nextItems.filter((item) => item.status === "failed").length;
      conflictCount += nextItems.filter((item) => item.status === "conflict").length;
      pushedAt = response.syncedAt;

      for (const item of nextItems) {
        if (item.status === "conflict") {
          conflictedEntityKeys.add(toEntityKey(item.entityType, item.entityId));
        }
      }
    }

    const pull = await pullAllPages({
      repositories: params.repositories,
      profile: params.profile,
      conflictedEntityKeys,
    });

    const syncedAt = pushedAt ?? pull.syncedAt ?? params.profile.lastSyncedAt;

    await params.repositories.syncProfiles.save({
      ...pull.profile,
      lastSyncedAt: syncedAt,
      updatedAt: new Date().toISOString(),
    });

    return {
      attempted: pendingItems.length,
      synced: syncedCount,
      failed: failedCount,
      conflicts: conflictCount,
      pulled: pull.pulled,
      syncedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await Promise.all(
      pendingItems.map((item) =>
        params.repositories.syncOutbox.upsert(
          withOutboxUpdate(item, {
            status: "failed",
            lastError: message,
          }),
        ),
      ),
    );

    return {
      attempted: pendingItems.length,
      synced: 0,
      failed: pendingItems.length,
      conflicts: 0,
      error: message,
    };
  }
}
