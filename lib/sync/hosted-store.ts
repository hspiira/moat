import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConflictStrategy, isSyncableEntityType } from "@/lib/sync/entity-sync";
import type {
  SyncPullRecord,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
} from "@/lib/sync/types";

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

const STORE_DIR = path.join(process.cwd(), ".moat-sync");
const STORE_PATH = path.join(STORE_DIR, "hosted-sync.json");

function getEntityKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

function createEmptyState(): HostedSyncState {
  return { users: {} };
}

async function readState(): Promise<HostedSyncState> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as HostedSyncState;
  } catch {
    return createEmptyState();
  }
}

async function writeState(state: HostedSyncState) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(state, null, 2));
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

  return {
    userId: request.userId,
    since: request.since as string | undefined,
  };
}

export async function applyHostedSyncPush(request: SyncPushRequest): Promise<SyncPushResponse> {
  const state = await readState();
  const userState = getUserState(state, request.userId);

  const results = request.items.map((item) => {
    if (!isSyncableEntityType(item.entityType)) {
      return {
        outboxId: item.outboxId,
        status: "failed" as const,
        error: `Unsupported sync entity type: ${item.entityType}`,
      };
    }

    const key = getEntityKey(item.entityType, item.entityId);
    const existing = userState.records[key];

    if (userState.appliedOutboxIds[item.outboxId]) {
      return {
        outboxId: item.outboxId,
        status: "synced" as const,
        strategy: getConflictStrategy(item.entityType),
        serverVersionToken: existing?.serverVersionToken,
        serverRecord: existing
          ? {
              entityType: existing.entityType,
              entityId: existing.entityId,
              payload: existing.payload,
              deleted: existing.deleted,
              updatedAt: existing.updatedAt,
              serverVersionToken: existing.serverVersionToken,
            }
          : undefined,
      };
    }

    const strategy = getConflictStrategy(item.entityType);
    const payload = item.operation === "remove" ? null : item.payload;

    if (item.operation === "upsert") {
      try {
        const parsed = JSON.parse(item.payload) as { id?: string };
        if (parsed.id && parsed.id !== item.entityId) {
          return {
            outboxId: item.outboxId,
            status: "failed" as const,
            error: "Sync payload id does not match entityId.",
          };
        }
      } catch {
        return {
          outboxId: item.outboxId,
          status: "failed" as const,
          error: "Sync payload is not valid JSON.",
        };
      }
    }

    const sameAsServer =
      existing &&
      existing.deleted === (item.operation === "remove") &&
      existing.payload === payload;

    if (!existing || sameAsServer) {
      if (!sameAsServer) {
        userState.records[key] = createServerRecord({
          entityType: item.entityType,
          entityId: item.entityId,
          payload,
          deleted: item.operation === "remove",
          outboxId: item.outboxId,
          deviceId: request.device.id,
        });
      }

      userState.appliedOutboxIds[item.outboxId] = new Date().toISOString();
      const current = userState.records[key];
      return {
        outboxId: item.outboxId,
        status: "synced" as const,
        strategy,
        serverVersionToken: current?.serverVersionToken,
        serverRecord: current
          ? {
              entityType: current.entityType,
              entityId: current.entityId,
              payload: current.payload,
              deleted: current.deleted,
              updatedAt: current.updatedAt,
              serverVersionToken: current.serverVersionToken,
            }
          : undefined,
      };
    }

    if (strategy === "client_wins") {
      userState.records[key] = createServerRecord({
        entityType: item.entityType,
        entityId: item.entityId,
        payload,
        deleted: item.operation === "remove",
        outboxId: item.outboxId,
        deviceId: request.device.id,
      });
      userState.appliedOutboxIds[item.outboxId] = new Date().toISOString();
      const current = userState.records[key];
      return {
        outboxId: item.outboxId,
        status: "synced" as const,
        strategy,
        serverVersionToken: current.serverVersionToken,
        serverRecord: {
          entityType: current.entityType,
          entityId: current.entityId,
          payload: current.payload,
          deleted: current.deleted,
          updatedAt: current.updatedAt,
          serverVersionToken: current.serverVersionToken,
        },
      };
    }

    if (strategy === "server_wins") {
      userState.appliedOutboxIds[item.outboxId] = new Date().toISOString();
      return {
        outboxId: item.outboxId,
        status: "synced" as const,
        strategy,
        serverVersionToken: existing.serverVersionToken,
        serverRecord: {
          entityType: existing.entityType,
          entityId: existing.entityId,
          payload: existing.payload,
          deleted: existing.deleted,
          updatedAt: existing.updatedAt,
          serverVersionToken: existing.serverVersionToken,
        },
      };
    }

    return {
      outboxId: item.outboxId,
      status: "conflict" as const,
      strategy,
      error: "Manual review required before this ledger-affecting record can be synced.",
      serverVersionToken: existing.serverVersionToken,
      serverRecord: {
        entityType: existing.entityType,
        entityId: existing.entityId,
        payload: existing.payload,
        deleted: existing.deleted,
        updatedAt: existing.updatedAt,
        serverVersionToken: existing.serverVersionToken,
      },
    };
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
  const records = Object.values(userState.records)
    .filter((record) => !request.since || record.updatedAt > request.since)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    .map((record) => ({
      entityType: record.entityType,
      entityId: record.entityId,
      payload: record.payload,
      deleted: record.deleted,
      updatedAt: record.updatedAt,
      serverVersionToken: record.serverVersionToken,
    }));

  return {
    syncedAt: new Date().toISOString(),
    records,
  };
}
