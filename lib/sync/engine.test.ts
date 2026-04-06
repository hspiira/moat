import { describe, expect, it, vi, afterEach } from "vitest";

import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";

import { runHostedSync } from "@/lib/sync/engine";

afterEach(() => {
  vi.restoreAllMocks();
});

function createRepositories(items: SyncOutboxItem[], profile: SyncProfile): RepositoryBundle {
  const outbox = [...items];
  let currentProfile = { ...profile };

  const syncOutbox = {
    getById: vi.fn(),
    listByUser: vi.fn(async () => outbox),
    listPendingByUser: vi.fn(async () =>
      outbox.filter((item) => item.status === "pending" || item.status === "failed"),
    ),
    upsert: vi.fn(async (item: SyncOutboxItem) => {
      const index = outbox.findIndex((entry) => entry.id === item.id);
      if (index >= 0) outbox[index] = item;
      else outbox.push(item);
      return item;
    }),
    remove: vi.fn(),
  };

  const syncProfiles = {
    getByUser: vi.fn(async () => currentProfile),
    save: vi.fn(async (profileInput: SyncProfile) => {
      currentProfile = profileInput;
      return profileInput;
    }),
  };

  return {
    userProfile: {} as RepositoryBundle["userProfile"],
    accounts: {} as RepositoryBundle["accounts"],
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
    syncProfiles,
    syncOutbox,
  };
}

describe("runHostedSync", () => {
  it("pushes pending outbox items and marks them synced", async () => {
    const repositories = createRepositories(
      [
        {
          id: "sync-outbox:1",
          userId: "u1",
          entityType: "transactions",
          entityId: "t1",
          operation: "upsert",
          payload: "{\"id\":\"t1\"}",
          status: "pending",
          attempts: 0,
          queuedAt: "2026-04-06T00:00:00.000Z",
          updatedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
      {
        id: "sync-profile:u1",
        userId: "u1",
        mode: "hosted_opt_in",
        hostedSyncEnabled: true,
        postgresSyncUrl: "https://sync.example.com",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            syncedAt: "2026-04-06T12:00:00.000Z",
            results: [{ outboxId: "sync-outbox:1", status: "synced" }],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await runHostedSync({
      repositories,
      profile: await repositories.syncProfiles.getByUser("u1") as SyncProfile,
      isOnline: true,
    });

    expect(result).toMatchObject({
      attempted: 1,
      synced: 1,
      failed: 0,
      syncedAt: "2026-04-06T12:00:00.000Z",
    });
  });

  it("does not attempt sync while offline", async () => {
    const repositories = createRepositories([], {
      id: "sync-profile:u1",
      userId: "u1",
      mode: "hosted_opt_in",
      hostedSyncEnabled: true,
      postgresSyncUrl: "https://sync.example.com",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    const result = await runHostedSync({
      repositories,
      profile: await repositories.syncProfiles.getByUser("u1") as SyncProfile,
      isOnline: false,
    });

    expect(result.error).toBe("Device is offline.");
  });
});
