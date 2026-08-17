/**
 * Runs only when DATABASE_URL points at a throwaway Postgres:
 *
 *   DATABASE_SSL=disable DATABASE_URL=postgres://localhost/moat_test pnpm test
 *
 * It creates and drops its own tables, so do not aim it at anything real.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { SyncPushRequest } from "@/lib/sync/types";

import { closePool, getPool } from "./pool.js";
import { applyPostgresSyncPush, pullPostgresSyncChanges } from "./postgres-store.js";
import { SCHEMA_SQL } from "./schema.js";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = hasDatabase ? describe : describe.skip;

function pushRequest(
  userId: string,
  ids: string[],
  overrides: Partial<SyncPushRequest["items"][number]> = {},
): SyncPushRequest {
  return {
    userId,
    device: { app: "moat", platform: "web", id: "device:1" },
    items: ids.map((id, index) => ({
      outboxId: `sync-outbox:${userId}:${id}:${index}`,
      entityType: "categories",
      entityId: id,
      operation: "upsert" as const,
      payload: JSON.stringify({ id }),
      queuedAt: "2026-04-06T00:00:00.000Z",
      ...overrides,
    })),
  };
}

describeDb("postgres sync store", () => {
  beforeEach(async () => {
    await getPool().query(`
      drop table if exists sync_applied_outbox;
      drop table if exists sync_records;
      drop table if exists sync_users;
    `);
    await getPool().query(SCHEMA_SQL);
  });

  afterAll(closePool);

  it("applies the schema and stores a pushed record", async () => {
    const response = await applyPostgresSyncPush(pushRequest("u1", ["category:1"]));

    expect(response.results[0]).toMatchObject({ status: "synced" });
    expect(response.results[0].serverVersionToken).toMatch(/^sv:/);
  });

  it("replays an already applied outbox id without writing twice", async () => {
    const request = pushRequest("u1", ["category:1"]);
    const first = await applyPostgresSyncPush(request);
    const second = await applyPostgresSyncPush(request);

    expect(second.results[0].status).toBe("synced");
    expect(second.results[0].serverVersionToken).toBe(first.results[0].serverVersionToken);
  });

  it("accepts an edit that carries the current version token", async () => {
    const first = await applyPostgresSyncPush(pushRequest("u1", ["category:1"]));
    const token = first.results[0].serverVersionToken;

    const edit = pushRequest("u1", ["category:1"], { baseVersionToken: token });
    edit.items[0].outboxId = "sync-outbox:edit";
    edit.items[0].payload = JSON.stringify({ id: "category:1", name: "Food" });

    const second = await applyPostgresSyncPush(edit);

    expect(second.results[0].status).toBe("synced");
    expect(second.results[0].serverVersionToken).not.toBe(token);
  });

  it("conflicts on a ledger record edited from a stale version", async () => {
    const seed: SyncPushRequest = {
      userId: "u1",
      device: { app: "moat", platform: "web" },
      items: [
        {
          outboxId: "sync-outbox:seed",
          entityType: "transactions",
          entityId: "transaction:1",
          operation: "upsert",
          payload: JSON.stringify({ id: "transaction:1", amount: 100 }),
          queuedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
    };
    await applyPostgresSyncPush(seed);

    const stale: SyncPushRequest = {
      ...seed,
      items: [
        {
          ...seed.items[0],
          outboxId: "sync-outbox:stale",
          payload: JSON.stringify({ id: "transaction:1", amount: 999 }),
          baseVersionToken: "sv:not-the-current-one",
        },
      ],
    };

    const response = await applyPostgresSyncPush(stale);

    expect(response.results[0].status).toBe("conflict");
  });

  it("pages a pull without dropping or repeating records", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `category:${String(index).padStart(3, "0")}`);
    await applyPostgresSyncPush(pushRequest("u1", ids));

    const seen: string[] = [];
    let since: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const response = await pullPostgresSyncChanges({ userId: "u1", since, limit: 5 });
      seen.push(...response.records.map((record) => record.entityId));
      since = response.nextSince;
      if (!response.hasMore) break;
    }

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("returns nothing for a user with no records", async () => {
    await applyPostgresSyncPush(pushRequest("u1", ["category:1"]));

    const response = await pullPostgresSyncChanges({ userId: "u2" });

    expect(response.records).toHaveLength(0);
  });

  it("keeps one user's records out of another user's pull", async () => {
    await applyPostgresSyncPush(pushRequest("u1", ["category:1", "category:2"]));
    await applyPostgresSyncPush(pushRequest("u2", ["category:9"]));

    const response = await pullPostgresSyncChanges({ userId: "u2" });

    expect(response.records.map((record) => record.entityId)).toEqual(["category:9"]);
  });
});
