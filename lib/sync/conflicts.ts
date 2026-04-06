import { repositories as defaultRepositories } from "@/lib/repositories/instance";
import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncPullRecord } from "@/lib/sync/types";
import type { SyncOutboxItem } from "@/lib/types";

import { applyPulledRecord, getConflictStrategy } from "@/lib/sync/entity-sync";
import { runWithSyncMutationSuppressed } from "@/lib/sync/mutation-scope";

export type SyncConflictRecord = {
  item: SyncOutboxItem;
  localPayload: unknown;
  serverRecord: SyncPullRecord | null;
  strategy: ReturnType<typeof getConflictStrategy>;
};

function parseJsonValue(value: string | undefined): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseServerRecord(item: SyncOutboxItem): SyncPullRecord | null {
  const parsed = parseJsonValue(item.conflictPayload);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Partial<SyncPullRecord>;
  if (
    typeof record.entityType !== "string" ||
    typeof record.entityId !== "string" ||
    typeof record.deleted !== "boolean" ||
    typeof record.updatedAt !== "string" ||
    typeof record.serverVersionToken !== "string"
  ) {
    return null;
  }

  return {
    entityType: record.entityType,
    entityId: record.entityId,
    payload: typeof record.payload === "string" || record.payload === null ? record.payload : null,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    serverVersionToken: record.serverVersionToken,
  };
}

export async function listSyncConflicts(
  userId: string,
  bundle: RepositoryBundle = defaultRepositories,
): Promise<SyncConflictRecord[]> {
  const outbox = await bundle.syncOutbox.listByUser(userId);

  return outbox
    .filter((item) => item.status === "conflict")
    .map((item) => ({
      item,
      localPayload: parseJsonValue(item.payload),
      serverRecord: parseServerRecord(item),
      strategy: getConflictStrategy(item.entityType),
    }));
}

export async function resolveSyncConflictKeepLocal(
  outboxId: string,
  bundle: RepositoryBundle = defaultRepositories,
): Promise<void> {
  const item = await bundle.syncOutbox.getById(outboxId);
  if (!item || item.status !== "conflict") {
    throw new Error("The selected sync conflict could not be found.");
  }

  const timestamp = new Date().toISOString();
  await bundle.syncOutbox.upsert({
    ...item,
    id: `sync-outbox:${crypto.randomUUID()}`,
    status: "pending",
    attempts: 0,
    queuedAt: timestamp,
    updatedAt: timestamp,
    lastError: undefined,
    conflictPayload: undefined,
  });
  await bundle.syncOutbox.remove(outboxId);
}

export async function resolveSyncConflictUseServer(
  outboxId: string,
  bundle: RepositoryBundle = defaultRepositories,
): Promise<void> {
  const item = await bundle.syncOutbox.getById(outboxId);
  if (!item || item.status !== "conflict") {
    throw new Error("The selected sync conflict could not be found.");
  }

  const serverRecord = parseServerRecord(item);
  if (!serverRecord) {
    throw new Error("This conflict does not include a usable server record.");
  }

  await runWithSyncMutationSuppressed(async () => {
    await applyPulledRecord(bundle, serverRecord);
  });
  await bundle.syncOutbox.remove(outboxId);
}

