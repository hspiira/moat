import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";
import {
  listSyncableEntities,
  syncableEntityTypes,
  type SyncableEntityType,
} from "@/lib/sync/entity-sync";
import { toEntityKey } from "@/lib/sync/cursor";
import { createId } from "@/lib/ids";

export type SyncBackfillProgress = {
  entityType: SyncableEntityType;
  storesDone: number;
  storesTotal: number;
  queued: number;
};

export type SyncBackfillSummary = {
  queued: number;
  skipped: number;
  skippedReason?: string;
};

export function hasBackfilled(profile: SyncProfile): boolean {
  return Boolean(profile.backfilledAt);
}

export async function backfillSyncOutbox(params: {
  repositories: RepositoryBundle;
  profile: SyncProfile;
  onProgress?: (progress: SyncBackfillProgress) => void;
}): Promise<SyncBackfillSummary> {
  const { repositories, profile } = params;

  if (!profile.hostedSyncEnabled || profile.mode !== "hosted_opt_in") {
    return { queued: 0, skipped: 0, skippedReason: "Hosted sync is not enabled." };
  }

  if (hasBackfilled(profile)) {
    return { queued: 0, skipped: 0, skippedReason: "Backfill has already run for this profile." };
  }

  const existing = await repositories.syncOutbox.listByUser(profile.userId);
  const alreadyQueued = new Set(existing.map((item) => toEntityKey(item.entityType, item.entityId)));

  let queued = 0;
  let skipped = 0;
  let storesDone = 0;

  for (const entityType of syncableEntityTypes) {
    const records = await listSyncableEntities(repositories, entityType, profile.userId);

    for (const record of records) {
      const key = toEntityKey(entityType, record.id);
      if (alreadyQueued.has(key)) {
        skipped += 1;
        continue;
      }

      const timestamp = new Date().toISOString();
      const item: SyncOutboxItem = {
        id: createId(),
        userId: profile.userId,
        entityType,
        entityId: record.id,
        operation: "upsert",
        payload: JSON.stringify(record),
        status: "pending",
        attempts: 0,
        queuedAt: timestamp,
        updatedAt: timestamp,
      };

      await repositories.syncOutbox.upsert(item);
      alreadyQueued.add(key);
      queued += 1;
    }

    storesDone += 1;
    params.onProgress?.({
      entityType,
      storesDone,
      storesTotal: syncableEntityTypes.length,
      queued,
    });
  }

  const timestamp = new Date().toISOString();
  await repositories.syncProfiles.save({
    ...profile,
    backfilledAt: timestamp,
    updatedAt: timestamp,
  });

  return { queued, skipped };
}
