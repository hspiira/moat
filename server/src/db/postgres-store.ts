import type pg from "pg";

import { parseCursor, resolvePageSize, serializeCursor, toEntityKey } from "@/lib/sync/cursor";
import { getConflictStrategy, isSyncableEntityType } from "@/lib/sync/entity-sync";
import type {
  SyncPullRecord,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncPushResult,
} from "@/lib/sync/types";

import { withUserTransaction } from "./pool.js";

type StoredRecord = {
  entity_type: string;
  entity_id: string;
  payload: string | null;
  deleted: boolean;
  updated_at: string;
  server_version_token: string;
};

function toPullRecord(row: StoredRecord): SyncPullRecord {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    deleted: row.deleted,
    updatedAt: row.updated_at,
    serverVersionToken: row.server_version_token,
  };
}

function createServerVersionToken() {
  return `sv:${crypto.randomUUID()}`;
}

async function ensureUser(client: pg.PoolClient, userId: string) {
  await client.query(
    `insert into sync_users (user_id, created_at)
     values ($1, moat_now_iso())
     on conflict (user_id) do nothing`,
    [userId],
  );
}

async function writeRecord(
  client: pg.PoolClient,
  params: {
    userId: string;
    entityType: string;
    entityId: string;
    payload: string | null;
    deleted: boolean;
    outboxId: string;
    deviceId?: string;
  },
): Promise<StoredRecord> {
  const result = await client.query<StoredRecord>(
    `insert into sync_records (
       user_id, entity_type, entity_id, payload, deleted,
       updated_at, server_version_token, last_outbox_id, last_device_id
     )
     values ($1, $2, $3, $4, $5, moat_now_iso(), $6, $7, $8)
     on conflict (user_id, entity_type, entity_id) do update set
       payload = excluded.payload,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at,
       server_version_token = excluded.server_version_token,
       last_outbox_id = excluded.last_outbox_id,
       last_device_id = excluded.last_device_id
     returning entity_type, entity_id, payload, deleted, updated_at, server_version_token`,
    [
      params.userId,
      params.entityType,
      params.entityId,
      params.payload,
      params.deleted,
      createServerVersionToken(),
      params.outboxId,
      params.deviceId ?? null,
    ],
  );

  return result.rows[0];
}

async function markOutboxApplied(client: pg.PoolClient, userId: string, outboxId: string) {
  await client.query(
    `insert into sync_applied_outbox (user_id, outbox_id, applied_at)
     values ($1, $2, moat_now_iso())
     on conflict (user_id, outbox_id) do nothing`,
    [userId, outboxId],
  );
}

function isBasedOnCurrent(params: {
  baseVersionToken?: string;
  existing: StoredRecord;
  payload: string | null;
  deleted: boolean;
}): boolean {
  if (params.baseVersionToken) {
    return params.baseVersionToken === params.existing.server_version_token;
  }
  return params.existing.deleted === params.deleted && params.existing.payload === params.payload;
}

export async function applyPostgresSyncPush(
  request: SyncPushRequest,
): Promise<SyncPushResponse> {
  const items = [...request.items].sort((left, right) =>
    toEntityKey(left.entityType, left.entityId) < toEntityKey(right.entityType, right.entityId)
      ? -1
      : 1,
  );

  const results = await withUserTransaction(request.userId, async (client) => {
    await ensureUser(client, request.userId);
    const collected: SyncPushResult[] = [];

    for (const item of items) {
      collected.push(await applyOne(client, request, item));
    }

    return collected;
  });

  const byOutboxId = new Map(results.map((result) => [result.outboxId, result]));

  return {
    syncedAt: new Date().toISOString(),
    results: request.items.map(
      (item) =>
        byOutboxId.get(item.outboxId) ?? {
          outboxId: item.outboxId,
          status: "failed" as const,
          error: "Sync item was not processed.",
        },
    ),
  };
}

async function applyOne(
  client: pg.PoolClient,
  request: SyncPushRequest,
  item: SyncPushRequest["items"][number],
): Promise<SyncPushResult> {
  if (!isSyncableEntityType(item.entityType)) {
    return {
      outboxId: item.outboxId,
      status: "failed",
      error: `Unsupported sync entity type: ${item.entityType}`,
    };
  }

  const strategy = getConflictStrategy(item.entityType);
  const deleted = item.operation === "remove";
  const payload = deleted ? null : item.payload;

  const locked = await client.query<StoredRecord>(
    `select entity_type, entity_id, payload, deleted, updated_at, server_version_token
       from sync_records
      where user_id = $1 and entity_type = $2 and entity_id = $3
      for update`,
    [request.userId, item.entityType, item.entityId],
  );
  const existing = locked.rows[0];

  const replayed = await client.query(
    `select 1 from sync_applied_outbox where user_id = $1 and outbox_id = $2`,
    [request.userId, item.outboxId],
  );
  if ((replayed.rowCount ?? 0) > 0) {
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: existing?.server_version_token,
      serverRecord: existing ? toPullRecord(existing) : undefined,
    };
  }

  const accept = async (): Promise<SyncPushResult> => {
    const written = await writeRecord(client, {
      userId: request.userId,
      entityType: item.entityType,
      entityId: item.entityId,
      payload,
      deleted,
      outboxId: item.outboxId,
      deviceId: request.device.id,
    });
    await markOutboxApplied(client, request.userId, item.outboxId);
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: written.server_version_token,
      serverRecord: toPullRecord(written),
    };
  };

  if (!existing) {
    return accept();
  }

  if (isBasedOnCurrent({ baseVersionToken: item.baseVersionToken, existing, payload, deleted })) {
    return accept();
  }

  if (strategy === "client_wins") {
    return accept();
  }

  if (strategy === "server_wins") {
    await markOutboxApplied(client, request.userId, item.outboxId);
    return {
      outboxId: item.outboxId,
      status: "synced",
      strategy,
      serverVersionToken: existing.server_version_token,
      serverRecord: toPullRecord(existing),
    };
  }

  return {
    outboxId: item.outboxId,
    status: "conflict",
    strategy,
    error: "Manual review required before this ledger-affecting record can be synced.",
    serverVersionToken: existing.server_version_token,
    serverRecord: toPullRecord(existing),
  };
}

export async function pullPostgresSyncChanges(
  request: SyncPullRequest,
): Promise<SyncPullResponse> {
  const cursor = parseCursor(request.since);
  const pageSize = resolvePageSize(request.limit);

  const rows = await withUserTransaction(request.userId, async (client) => {
    await ensureUser(client, request.userId);

    const result = await client.query<StoredRecord>(
      `select entity_type, entity_id, payload, deleted, updated_at, server_version_token
         from sync_records
        where user_id = $1
          and ($2::text is null or (updated_at, entity_key) > ($2::text, $3::text))
        order by updated_at, entity_key
        limit $4`,
      [request.userId, cursor?.updatedAt ?? null, cursor?.entityKey ?? "", pageSize + 1],
    );

    return result.rows;
  });

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);

  return {
    syncedAt: new Date().toISOString(),
    records: page.map(toPullRecord),
    nextSince: last
      ? serializeCursor({
          updatedAt: last.updated_at,
          entityKey: toEntityKey(last.entity_type, last.entity_id),
        })
      : request.since,
    hasMore: rows.length > pageSize,
  };
}
