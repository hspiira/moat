import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateDek } from "@/lib/security/key-hierarchy";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import { openSyncPayload } from "@/lib/sync/payload-crypto";
import { createSyncPushRequest, pullSyncBatch } from "@/lib/sync/transport";
import type { SyncOutboxItem } from "@/lib/types";

const RECORD = JSON.stringify({
  id: "transaction:1",
  payee: "Auntie Grace",
  amount: 250_000,
});

const item: SyncOutboxItem = {
  id: "sync-outbox:1",
  userId: "user:owner",
  entityType: "transactions",
  entityId: "transaction:1",
  operation: "upsert",
  payload: RECORD,
  status: "pending",
  attempts: 0,
  queuedAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

beforeEach(async () => {
  setActiveRecordCryptoKey(await generateDek());
});

afterEach(() => {
  setActiveRecordCryptoKey(null);
});

describe("createSyncPushRequest", () => {
  it("sends nothing the server can read", async () => {
    const request = await createSyncPushRequest({ userId: "user:owner", items: [item] });
    const wire = JSON.stringify(request);

    expect(wire).not.toContain("Auntie Grace");
    expect(wire).not.toContain("250000");
    expect(request.items[0].payload).not.toContain("transaction:1");
  });

  it("still tells the server which record changed, so it can be stored and ordered", async () => {
    const request = await createSyncPushRequest({ userId: "user:owner", items: [item] });

    expect(request.items[0]).toMatchObject({
      outboxId: "sync-outbox:1",
      entityType: "transactions",
      entityId: "transaction:1",
      operation: "upsert",
      queuedAt: "2026-08-19T00:00:00.000Z",
    });
  });

  it("seals what this device can open again", async () => {
    const request = await createSyncPushRequest({ userId: "user:owner", items: [item] });

    expect(await openSyncPayload(request.items[0].payload)).toBe(RECORD);
  });

  it("refuses to build a request with no PIN set", async () => {
    setActiveRecordCryptoKey(null);

    await expect(
      createSyncPushRequest({ userId: "user:owner", items: [item] }),
    ).rejects.toThrow(/needs a PIN/);
  });
});

describe("being asked to slow down", () => {
  it("says so, and when to come back, rather than showing a status code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Too many requests." }), {
            status: 429,
            headers: { "retry-after": "37" },
          }),
      ),
    );

    await expect(
      pullSyncBatch({ endpoint: "https://sync.example.com", request: { userId: "u1" } }),
    ).rejects.toThrow("Sync is being asked for too often. Try again in 37s.");
  });

  it("still reports an ordinary failure by its status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    await expect(
      pullSyncBatch({ endpoint: "https://sync.example.com", request: { userId: "u1" } }),
    ).rejects.toThrow("status 500");
  });
});
