import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  compareByCursorOrder,
  isAfterCursor,
  parseCursor,
  resolvePageSize,
  serializeCursor,
  toEntityKey,
} from "@/lib/sync/cursor";
import { getConflictStrategy, isSyncableEntityType } from "@/lib/sync/entity-sync";
import type {
  SyncPullRecord,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncPushResult,
} from "@/lib/sync/types";

type SyncConflictStrategy = ReturnType<typeof getConflictStrategy>;

type HostedRecord = SyncPullRecord & {
  lastOutboxId?: string;
  lastDeviceId?: string;
};

type HostedSyncUserState = {
  records: Record<string, HostedRecord>;
  appliedOutboxIds: Record<string, string>;
};

type HostedSyncState = {
  users: Record<string, HostedSyncUserState>;
};

function getStorePath() {
  return process.env.MOAT_SYNC_STORE_PATH ?? path.join(process.cwd(), ".moat-sync", "hosted-sync.json");
}

function getEntityKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

function createEmptyState(): HostedSyncState {
  return { users: {} };
}

async function readState(): Promise<HostedSyncState> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    return JSON.parse(raw) as HostedSyncState;
  } catch {
    return createEmptyState();
  }
}

async function writeState(state: HostedSyncState) {
  const storePath = getStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(state, null, 2));
}

function getUserState(state: HostedSyncState, userId: string): HostedSyncUserState {
  state.users[userId] ??= {
    records: {},
    appliedOutboxIds: {},
  };
  return state.users[userId];
}

function createServerVersionToken() {
  return `sv:${crypto.randomUUID()}`;
}

function createServerRecord(params: {
  entityType: string;
  entityId: string;
  payload: string | null;
  deleted: boolean;
  outboxId?: string;
  deviceId?: string;
}): HostedRecord {
  return {
    entityType: params.entityType,
    entityId: params.entityId,
    payload: params.payload,
    deleted: params.deleted,
    updatedAt: new Date().toISOString(),
    serverVersionToken: createServerVersionToken(),
    lastOutboxId: params.outboxId,
    lastDeviceId: params.deviceId,
  };
}

function toPullRecord(record: HostedRecord): SyncPullRecord {
  return {
    entityType: record.entityType,
    entityId: record.entityId,
    payload: record.payload,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    serverVersionToken: record.serverVersionToken,
  };
}

function resolveConflict(params: {
  userState: HostedSyncUserState;
  key: string;
  strategy: SyncConflictStrategy;
  existing: HostedRecord;
  entityType: string;
  entityId: string;
  payload: string | null;
  deleted: boolean;
  outboxId: string;
  deviceId?: string;
}): SyncPushResult {
  const { userState, key, strategy, existing, outboxId } = params;

  if (strategy === "client_wins") {
    userState.records[key] = createServerRecord({
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload,
      deleted: params.deleted,
      outboxId,
      deviceId: params.deviceId,
    });
    userState.appliedOutboxIds[outboxId] = new Date().toISOString();
    const current = userState.records[key];
    return {
      outboxId,
      status: "synced",
      strategy,
      serverVersionToken: current.serverVersionToken,
      serverRecord: toPullRecord(current),
    };
  }

  if (strategy === "server_wins") {
    userState.appliedOutboxIds[outboxId] = new Date().toISOString();
    return {
      outboxId,
      status: "synced",
      strategy,
      serverVersionToken: existing.serverVersionToken,
      serverRecord: toPullRecord(existing),
    };
  }

  return {
    outboxId,
    status: "conflict",
    strategy,
    error: "Manual review required before this ledger-affecting record can be synced.",
    serverVersionToken: existing.serverVersionToken,
    serverRecord: toPullRecord(existing),
  };
}

export function validateSyncPullRequest(input: unknown): SyncPullRequest {
  if (!input || typeof input !== "object") {
    throw new Error("Sync pull payload must be an object.");
  }

  const request = input as Record<string, unknown>;
  if (typeof request.userId !== "string" || !request.userId.trim()) {
    throw new Error("Sync pull requires a userId.");
  }

  if (request.since !== undefined && typeof request.since !== "string") {
    throw new Error("Sync pull since token must be a string when provided.");
  }

  if (
    request.limit !== undefined &&
    (typeof request.limit !== "number" || !Number.isFinite(request.limit))
  ) {
    throw new Error("Sync pull limit must be a finite number when provided.");
  }

  return {
    userId: request.userId,
    since: request.since as string | undefined,
    limit: request.limit as number | undefined,
  };
}

export async function applyHostedSyncPush(request: SyncPushRequest): Promise<SyncPushResponse> {
  const state = await readState();
  const userState = getUserState(state, request.userId);

  const results = request.items.map((item): SyncPushResult => {
    if (!isSyncableEntityType(item.entityType)) {
      return {
        outboxId: item.outboxId,
        status: "failed",
        error: `Unsupported sync entity type: ${item.entityType}`,
      };
    }

    const key = getEntityKey(item.entityType, item.entityId);
    const existing = userState.records[key];

    if (userState.appliedOutboxIds[item.outboxId]) {
      return {
        outboxId: item.outboxId,
        status: "synced",
        strategy: getConflictStrategy(item.entityType),
        serverVersionToken: existing?.serverVersionToken,
        serverRecord: existing ? toPullRecord(existing) : undefined,
      };
    }

    const strategy = getConflictStrategy(item.entityType);
    const deleted = item.operation === "remove";
    const payload = deleted ? null : item.payload;

    if (item.operation === "upsert") {
      try {
        const parsed = JSON.parse(item.payload) as { id?: string };
        if (parsed.id && parsed.id !== item.entityId) {
          return {
            outboxId: item.outboxId,
            status: "failed",
            error: "Sync payload id does not match entityId.",
          };
        }
      } catch {
        return {
          outboxId: item.outboxId,
          status: "failed",
          error: "Sync payload is not valid JSON.",
        };
      }
    }

    const sameAsServer =
      existing && existing.deleted === deleted && existing.payload === payload;

    if (!existing || sameAsServer) {
      if (!sameAsServer) {
        userState.records[key] = createServerRecord({
          entityType: item.entityType,
          entityId: item.entityId,
          payload,
          deleted,
          outboxId: item.outboxId,
          deviceId: request.device.id,
        });
      }

      userState.appliedOutboxIds[item.outboxId] = new Date().toISOString();
      const current = userState.records[key];
      return {
        outboxId: item.outboxId,
        status: "synced",
        strategy,
        serverVersionToken: current?.serverVersionToken,
        serverRecord: current ? toPullRecord(current) : undefined,
      };
    }

    return resolveConflict({
      userState,
      key,
      strategy,
      existing,
      entityType: item.entityType,
      entityId: item.entityId,
      payload,
      deleted,
      outboxId: item.outboxId,
      deviceId: request.device.id,
    });
  });

  await writeState(state);

  return {
    syncedAt: new Date().toISOString(),
    results,
  };
}

export async function pullHostedSyncChanges(request: SyncPullRequest): Promise<SyncPullResponse> {
  const state = await readState();
  const userState = getUserState(state, request.userId);

  const cursor = parseCursor(request.since);
  const pageSize = resolvePageSize(request.limit);

  const ordered = Object.values(userState.records)
    .map((record) => ({
      record,
      position: {
        updatedAt: record.updatedAt,
        entityKey: toEntityKey(record.entityType, record.entityId),
      },
    }))
    .filter((entry) => isAfterCursor(entry.position, cursor))
    .sort((left, right) => compareByCursorOrder(left.position, right.position));

  const page = ordered.slice(0, pageSize);
  const last = page.at(-1);

  return {
    syncedAt: new Date().toISOString(),
    records: page.map((entry) => toPullRecord(entry.record)),
    nextSince: last ? serializeCursor(last.position) : request.since,
    hasMore: ordered.length > pageSize,
  };
}
