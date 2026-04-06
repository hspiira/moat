import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";
import type { SyncPullRecord, SyncPushResult, SyncRunSummary } from "@/lib/sync/types";

import { applyPulledRecord, getConflictStrategy } from "@/lib/sync/entity-sync";
import { createSyncPushRequest, pullSyncBatch, pushSyncBatch } from "@/lib/sync/transport";

function withOutboxUpdate(
  item: SyncOutboxItem,
  patch: Partial<SyncOutboxItem>,
): SyncOutboxItem {
  return {
    ...item,
    ...patch,
    attempts: item.attempts + (patch.status === "syncing" ? 0 : 1),
    updatedAt: new Date().toISOString(),
  };
}

function mapResultForItem(item: SyncOutboxItem, result?: SyncPushResult): SyncOutboxItem {
  if (!result) {
    return withOutboxUpdate(item, {
      status: "failed",
      lastError: "Sync response did not include this outbox item.",
    });
  }

  if (result.status === "conflict") {
    return withOutboxUpdate(item, {
      status: "conflict",
      lastError: result.error,
      conflictPayload: result.serverRecord ? JSON.stringify(result.serverRecord) : undefined,
    });
  }

  return withOutboxUpdate(item, {
    status: result.status === "synced" ? "synced" : "failed",
    lastError: result.error,
    conflictPayload: undefined,
  });
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

    await applyPulledRecord(params.repositories, record);
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

  const pendingItems = await params.repositories.syncOutbox.listPendingByUser(params.profile.userId);
  if (pendingItems.length === 0) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
      syncedAt: params.profile.lastSyncedAt,
    };
  }

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
    const response = await pushSyncBatch({
      endpoint: params.profile.postgresSyncUrl,
      request: createSyncPushRequest({
        userId: params.profile.userId,
        items: pendingItems,
        platform: params.platform,
        deviceId: params.profile.deviceId,
      }),
      authToken: params.profile.syncAuthToken,
    });

    const nextItems = pendingItems.map((item) =>
      mapResultForItem(
        item,
        response.results.find((result) => result.outboxId === item.id),
      ),
    );

    await Promise.all(nextItems.map((item) => params.repositories.syncOutbox.upsert(item)));

    const syncedCount = nextItems.filter((item) => item.status === "synced").length;
    const failedCount = nextItems.filter((item) => item.status === "failed").length;
    const conflictCount = nextItems.filter((item) => item.status === "conflict").length;

    const conflictedEntityKeys = new Set(
      nextItems
        .filter((item) => item.status === "conflict")
        .map((item) => `${item.entityType}:${item.entityId}`),
    );

    const pullResponse = await pullSyncBatch({
      endpoint: params.profile.postgresSyncUrl,
      authToken: params.profile.syncAuthToken,
      request: {
        userId: params.profile.userId,
        since: params.profile.lastPulledAt ?? params.profile.lastSyncedAt,
      },
    });

    await applyPulledRecords({
      repositories: params.repositories,
      records: pullResponse.records,
      conflictedEntityKeys,
    });

    await params.repositories.syncProfiles.save({
      ...params.profile,
      lastSyncedAt: response.syncedAt,
      lastPulledAt: pullResponse.syncedAt,
      updatedAt: new Date().toISOString(),
    });

    return {
      attempted: pendingItems.length,
      synced: syncedCount,
      failed: failedCount,
      conflicts: conflictCount,
      syncedAt: response.syncedAt,
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
