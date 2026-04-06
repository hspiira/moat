import { describe, expect, it, vi } from "vitest";

import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem } from "@/lib/types";

import {
  listSyncConflicts,
  resolveSyncConflictKeepLocal,
  resolveSyncConflictUseServer,
} from "@/lib/sync/conflicts";

function createRepositories(items: SyncOutboxItem[]): RepositoryBundle {
  const outbox = [...items];
  const accounts = new Map<string, unknown>();
  const syncOutbox = {
    getById: vi.fn(async (id: string) => outbox.find((item) => item.id === id) ?? null),
    listByUser: vi.fn(async () => outbox),
    listPendingByUser: vi.fn(async () => outbox.filter((item) => item.status === "pending")),
    upsert: vi.fn(async (item: SyncOutboxItem) => {
      const index = outbox.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        outbox[index] = item;
      } else {
        outbox.push(item);
      }
      return item;
    }),
    remove: vi.fn(async (id: string) => {
      const index = outbox.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        outbox.splice(index, 1);
      }
    }),
  };

  return {
    userProfile: {} as RepositoryBundle["userProfile"],
    accounts: {
      getById: vi.fn(async (id: string) => (accounts.get(id) as never) ?? null),
      listByUser: vi.fn(async () => []),
      upsert: vi.fn(async (value) => {
        accounts.set(value.id, value);
        return value;
      }),
      remove: vi.fn(async (id: string) => {
        accounts.delete(id);
      }),
    } as RepositoryBundle["accounts"],
    transactions: {} as RepositoryBundle["transactions"],
    captureEnvelopes: {} as RepositoryBundle["captureEnvelopes"],
    captureReviewItems: {} as RepositoryBundle["captureReviewItems"],
    correctionLogs: {} as RepositoryBundle["correctionLogs"],
    transactionRules: {} as RepositoryBundle["transactionRules"],
    recurringObligations: {} as RepositoryBundle["recurringObligations"],
    monthCloses: {} as RepositoryBundle["monthCloses"],
    categories: {} as RepositoryBundle["categories"],
    goals: {} as RepositoryBundle["goals"],
    budgets: {} as RepositoryBundle["budgets"],
    investmentProfiles: {} as RepositoryBundle["investmentProfiles"],
    imports: {} as RepositoryBundle["imports"],
    resources: {} as RepositoryBundle["resources"],
    syncProfiles: {} as RepositoryBundle["syncProfiles"],
    syncOutbox,
  };
}

describe("sync conflict helpers", () => {
  it("lists conflicts with parsed local and server payloads", async () => {
    const repositories = createRepositories([
      {
        id: "sync-outbox:1",
        userId: "u1",
        entityType: "accounts",
        entityId: "account:1",
        operation: "upsert",
        payload: "{\"id\":\"account:1\",\"name\":\"Wallet\"}",
        status: "conflict",
        attempts: 1,
        queuedAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        conflictPayload:
          "{\"entityType\":\"accounts\",\"entityId\":\"account:1\",\"payload\":\"{\\\"id\\\":\\\"account:1\\\",\\\"name\\\":\\\"Server\\\"}\",\"deleted\":false,\"updatedAt\":\"2026-04-07T00:00:00.000Z\",\"serverVersionToken\":\"sv:1\"}",
      },
    ]);

    const results = await listSyncConflicts("u1", repositories);
    expect(results[0]).toMatchObject({
      strategy: "manual_review",
      localPayload: { id: "account:1", name: "Wallet" },
      serverRecord: { entityId: "account:1" },
    });
  });

  it("requeues the local version when keeping local", async () => {
    const repositories = createRepositories([
      {
        id: "sync-outbox:1",
        userId: "u1",
        entityType: "accounts",
        entityId: "account:1",
        operation: "upsert",
        payload: "{\"id\":\"account:1\"}",
        status: "conflict",
        attempts: 1,
        queuedAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
      },
    ]);

    await resolveSyncConflictKeepLocal("sync-outbox:1", repositories);

    const items = await repositories.syncOutbox.listByUser("u1");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: "pending",
      entityId: "account:1",
    });
    expect(items[0].id).not.toBe("sync-outbox:1");
  });

  it("applies the server version locally without requeueing sync", async () => {
    const repositories = createRepositories([
      {
        id: "sync-outbox:1",
        userId: "u1",
        entityType: "accounts",
        entityId: "account:1",
        operation: "upsert",
        payload: "{\"id\":\"account:1\",\"name\":\"Wallet\"}",
        status: "conflict",
        attempts: 1,
        queuedAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        conflictPayload:
          "{\"entityType\":\"accounts\",\"entityId\":\"account:1\",\"payload\":\"{\\\"id\\\":\\\"account:1\\\",\\\"name\\\":\\\"Server\\\",\\\"userId\\\":\\\"u1\\\"}\",\"deleted\":false,\"updatedAt\":\"2026-04-07T00:00:00.000Z\",\"serverVersionToken\":\"sv:1\"}",
      },
    ]);

    await resolveSyncConflictUseServer("sync-outbox:1", repositories);

    expect(repositories.accounts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Server" }),
    );
    expect(await repositories.syncOutbox.listByUser("u1")).toHaveLength(0);
  });
});
