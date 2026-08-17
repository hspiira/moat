/**
 * Runs only when DATABASE_URL points at a throwaway Postgres:
 *
 *   DATABASE_SSL=disable DATABASE_URL=postgres://localhost/moat_test pnpm test
 *
 * It creates and drops its own tables, so do not aim it at anything real.
 */
import pg from "pg";
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

  /**
   * The reason the cursor is composite. These rows all carry the same
   * updated_at, so a timestamp-only cursor would either drop the tail of the
   * group or serve it forever.
   */
  it("pages through records that all share one timestamp", async () => {
    await getPool().query(
      `insert into sync_users (user_id, created_at) values ('u1', '2026-01-01T00:00:00.000Z')`,
    );
    await getPool().query(
      `insert into sync_records (user_id, entity_type, entity_id, payload, deleted, updated_at, server_version_token)
       select 'u1', 'categories', 'category:' || lpad(g::text, 3, '0'), '{}', false,
              '2026-04-06T00:00:00.000Z', 'sv:' || g
         from generate_series(1, 25) g`,
    );

    const seen: string[] = [];
    let since: string | undefined;
    let pages = 0;

    for (let page = 0; page < 50; page += 1) {
      const response = await pullPostgresSyncChanges({ userId: "u1", since, limit: 4 });
      seen.push(...response.records.map((record) => record.entityId));
      since = response.nextSince;
      pages += 1;
      if (!response.hasMore) break;
    }

    expect(new Set(seen).size).toBe(25);
    expect(seen).toHaveLength(25);
    expect(pages).toBe(7);
  });

  it("orders pages the same way the client compares cursors", async () => {
    await getPool().query(
      `insert into sync_users (user_id, created_at) values ('u1', '2026-01-01T00:00:00.000Z')`,
    );
    await getPool().query(
      `insert into sync_records (user_id, entity_type, entity_id, payload, deleted, updated_at, server_version_token)
       values ('u1','transactionLineItems','a','{}',false,'2026-04-06T00:00:00.000Z','sv:1'),
              ('u1','transactions','a','{}',false,'2026-04-06T00:00:00.000Z','sv:2'),
              ('u1','transactionRules','a','{}',false,'2026-04-06T00:00:00.000Z','sv:3')`,
    );

    const response = await pullPostgresSyncChanges({ userId: "u1" });
    const serverOrder = response.records.map(
      (record) => `${record.entityType}:${record.entityId}`,
    );

    expect(serverOrder).toEqual(
      [...serverOrder].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
    );
  });

  it("returns nothing for a user with no records", async () => {
    await applyPostgresSyncPush(pushRequest("u1", ["category:1"]));

    const response = await pullPostgresSyncChanges({ userId: "u2" });

    expect(response.records).toHaveLength(0);
  });

  /**
   * Every query already filters by user_id, so these tests would pass with no
   * policies at all — and the role running them is usually a superuser, which
   * bypasses RLS outright. This connects as an ordinary role to check the
   * database enforces tenancy on its own.
   */
  it("enforces tenancy in the database, not just in the query", async () => {
    await getPool().query(`
      drop role if exists moat_rls_test;
      create role moat_rls_test login password 'test';
      grant usage on schema public to moat_rls_test;
      grant select, insert, update, delete on all tables in schema public to moat_rls_test;
    `);

    await applyPostgresSyncPush(pushRequest("u1", ["category:1"]));
    await applyPostgresSyncPush(pushRequest("u2", ["category:2"]));

    const url = new URL(process.env.DATABASE_URL as string);
    url.username = "moat_rls_test";
    url.password = "test";
    const scoped = new pg.Pool({ connectionString: url.toString(), ssl: undefined });

    try {
      const client = await scoped.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('moat.user_id', $1, true)", ["u1"]);

        const visible = await client.query("select user_id from sync_records");
        expect(visible.rows.map((row: { user_id: string }) => row.user_id)).toEqual(["u1"]);

        await expect(
          client.query(
            `insert into sync_records (user_id, entity_type, entity_id, payload, deleted, updated_at, server_version_token)
             values ('u2','categories','stolen','{}',false,'x','sv:x')`,
          ),
        ).rejects.toThrow(/row-level security/i);

        await client.query("rollback");

        // With no tenant set the policy matches nothing, so it fails closed.
        const unscoped = await client.query("select count(*)::int as count from sync_records");
        expect(unscoped.rows[0].count).toBe(0);
      } finally {
        client.release();
      }
    } finally {
      await scoped.end();
      await getPool().query(`
        revoke all on all tables in schema public from moat_rls_test;
        revoke usage on schema public from moat_rls_test;
        drop role if exists moat_rls_test;
      `);
    }
  });

  it("keeps one user's records out of another user's pull", async () => {
    await applyPostgresSyncPush(pushRequest("u1", ["category:1", "category:2"]));
    await applyPostgresSyncPush(pushRequest("u2", ["category:9"]));

    const response = await pullPostgresSyncChanges({ userId: "u2" });

    expect(response.records.map((record) => record.entityId)).toEqual(["category:9"]);
  });
});
