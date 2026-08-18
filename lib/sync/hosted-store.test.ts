import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyHostedSyncPush, pullHostedSyncChanges } from "@/lib/sync/hosted-store";
import type { SyncPushRequest } from "@/lib/sync/types";

let storeDir: string;
const originalStorePath = process.env.MOAT_SYNC_STORE_PATH;

beforeEach(async () => {
  storeDir = await mkdtemp(path.join(tmpdir(), "moat-sync-"));
  process.env.MOAT_SYNC_STORE_PATH = path.join(storeDir, "hosted-sync.json");
});

afterEach(async () => {
  if (originalStorePath === undefined) delete process.env.MOAT_SYNC_STORE_PATH;
  else process.env.MOAT_SYNC_STORE_PATH = originalStorePath;
  await rm(storeDir, { recursive: true, force: true });
});

function pushRequest(userId: string, count: number, offset = 0): SyncPushRequest {
  return {
    userId,
    device: { app: "moat", platform: "web", id: "device:1" },
    items: Array.from({ length: count }, (_, index) => {
      const id = `category:${String(offset + index).padStart(4, "0")}`;
      return {
        outboxId: `sync-outbox:${offset + index}`,
        entityType: "categories",
        entityId: id,
        operation: "upsert" as const,
        payload: JSON.stringify({ id }),
        queuedAt: "2026-04-06T00:00:00.000Z",
      };
    }),
  };
}

async function writeIdenticalTimestamps(userId: string, updatedAt: string) {
  const storePath = process.env.MOAT_SYNC_STORE_PATH as string;
  const state = JSON.parse(await readFile(storePath, "utf8"));
  for (const record of Object.values(state.users[userId].records) as { updatedAt: string }[]) {
    record.updatedAt = updatedAt;
  }
  await writeFile(storePath, JSON.stringify(state));
}

async function pullAll(userId: string, limit: number) {
  const pages: string[][] = [];
  let since: string | undefined;

  for (let page = 0; page < 50; page += 1) {
    const response = await pullHostedSyncChanges({ userId, since, limit });
    pages.push(response.records.map((record) => record.entityId));
    since = response.nextSince;
    if (!response.hasMore) break;
  }

  return pages;
}

describe("pullHostedSyncChanges paging", () => {
  it("returns a bounded page and reports that more remain", async () => {
    await applyHostedSyncPush(pushRequest("u1", 12));

    const first = await pullHostedSyncChanges({ userId: "u1", limit: 5 });

    expect(first.records).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.nextSince).toBeDefined();
  });

  it("walks every record exactly once across pages", async () => {
    await applyHostedSyncPush(pushRequest("u1", 12));

    const seen = (await pullAll("u1", 5)).flat();

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("does not drop records sharing a timestamp across a page boundary", async () => {
    await applyHostedSyncPush(pushRequest("u1", 10));
    await writeIdenticalTimestamps("u1", "2026-04-06T00:00:00.000Z");

    const first = await pullHostedSyncChanges({ userId: "u1", limit: 4 });
    expect(new Set(first.records.map((record) => record.updatedAt)).size).toBe(1);

    const seen = (await pullAll("u1", 4)).flat();
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10);
  });

  it("stops with hasMore false on the final page", async () => {
    await applyHostedSyncPush(pushRequest("u1", 6));

    const last = await pullHostedSyncChanges({ userId: "u1", limit: 100 });

    expect(last.records).toHaveLength(6);
    expect(last.hasMore).toBe(false);
  });

  it("leaves the cursor untouched when a page is empty", async () => {
    await applyHostedSyncPush(pushRequest("u1", 2));
    const first = await pullHostedSyncChanges({ userId: "u1", limit: 100 });

    const empty = await pullHostedSyncChanges({ userId: "u1", since: first.nextSince });

    expect(empty.records).toHaveLength(0);
    expect(empty.hasMore).toBe(false);
    expect(empty.nextSince).toBe(first.nextSince);
  });

  it("picks up records written after the previous cursor", async () => {
    await applyHostedSyncPush(pushRequest("u1", 3));
    const first = await pullHostedSyncChanges({ userId: "u1", limit: 100 });

    await applyHostedSyncPush(pushRequest("u1", 2, 100));
    const second = await pullHostedSyncChanges({ userId: "u1", since: first.nextSince });

    expect(second.records.map((record) => record.entityId)).toEqual([
      "category:0100",
      "category:0101",
    ]);
  });

  it("keeps users separate", async () => {
    await applyHostedSyncPush(pushRequest("u1", 3));
    await applyHostedSyncPush(pushRequest("u2", 5, 200));

    const response = await pullHostedSyncChanges({ userId: "u2" });

    expect(response.records).toHaveLength(5);
  });
});
