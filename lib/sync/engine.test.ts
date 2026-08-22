import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

import { generateDek } from "@/lib/security/key-hierarchy";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import { sealSyncPayload } from "@/lib/sync/payload-crypto";

import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";

import { runHostedSync } from "@/lib/sync/engine";

beforeEach(async () => {
  setActiveRecordCryptoKey(await generateDek());
});

afterEach(() => {
  vi.restoreAllMocks();
  setActiveRecordCryptoKey(null);
});

function createRepositories(items: SyncOutboxItem[], profile: SyncProfile): RepositoryBundle {
  const outbox = [...items];
  let currentProfile = { ...profile };

  const syncOutbox = {
    getById: vi.fn(async (id: string) => outbox.find((item) => item.id === id) ?? null),
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
    accounts: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["accounts"],
    transactions: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      listByMonth: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["transactions"],
    captureEnvelopes: {} as RepositoryBundle["captureEnvelopes"],
    captureReviewItems: {} as RepositoryBundle["captureReviewItems"],
    correctionLogs: {} as RepositoryBundle["correctionLogs"],
    transactionRules: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["transactionRules"],
    recurringObligations: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["recurringObligations"],
    monthCloses: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      getByPeriod: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["monthCloses"],
    categories: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      listDefaults: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["categories"],
    counterparties: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["counterparties"],
    goals: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["goals"],
    budgets: {
      getById: vi.fn(),
      listByUser: vi.fn(),
      listByMonth: vi.fn(),
      upsert: vi.fn(async (value) => value),
      remove: vi.fn(),
    } as RepositoryBundle["budgets"],
    investmentProfiles: {
      getByUser: vi.fn(),
      save: vi.fn(async (value) => value),
    } as RepositoryBundle["investmentProfiles"],
    imports: {} as RepositoryBundle["imports"],
    resources: {} as RepositoryBundle["resources"],
    syncProfiles,
    syncOutbox,
    items: {} as RepositoryBundle["items"],
    plannedPurchases: {} as RepositoryBundle["plannedPurchases"],
    transactionLineItems: {} as RepositoryBundle["transactionLineItems"],
    projects: {} as RepositoryBundle["projects"],
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
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              syncedAt: "2026-04-06T12:00:00.000Z",
              results: [{ outboxId: "sync-outbox:1", status: "synced", strategy: "manual_review" }],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              syncedAt: "2026-04-06T12:00:01.000Z",
              records: [],
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
      conflicts: 0,
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
    expect(result.conflicts).toBe(0);
  });

  it("keeps manual-review conflicts in the outbox", async () => {
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
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              syncedAt: "2026-04-06T12:00:00.000Z",
              results: [
                {
                  outboxId: "sync-outbox:1",
                  status: "conflict",
                  strategy: "manual_review",
                  error: "Manual review required before this ledger-affecting record can be synced.",
                  serverRecord: {
                    entityType: "transactions",
                    entityId: "t1",
                    payload: await sealSyncPayload("{\"id\":\"t1\",\"amount\":100}"),
                    deleted: false,
                    updatedAt: "2026-04-06T12:00:00.000Z",
                    serverVersionToken: "sv:1",
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              syncedAt: "2026-04-06T12:00:01.000Z",
              records: [
                {
                  entityType: "transactions",
                  entityId: "t1",
                  payload: await sealSyncPayload("{\"id\":\"t1\",\"amount\":100}"),
                  deleted: false,
                  updatedAt: "2026-04-06T12:00:00.000Z",
                  serverVersionToken: "sv:1",
                },
              ],
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

    expect(result.conflicts).toBe(1);
    expect(result.failed).toBe(0);
    const persistedConflict = await repositories.syncOutbox.getById("sync-outbox:1");
    expect(persistedConflict).toMatchObject({
      status: "conflict",
    });
  });
});

function hostedProfile(): SyncProfile {
  return {
    id: "sync-profile:u1",
    userId: "u1",
    mode: "hosted_opt_in",
    hostedSyncEnabled: true,
    postgresSyncUrl: "https://sync.example.com",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
  };
}

function pendingItem(index: number): SyncOutboxItem {
  return {
    id: `sync-outbox:${index}`,
    userId: "u1",
    entityType: "categories",
    entityId: `category:${index}`,
    operation: "upsert",
    payload: JSON.stringify({ id: `category:${index}` }),
    status: "pending",
    attempts: 0,
    queuedAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

async function pullPage(params: { ids: string[]; nextSince?: string; hasMore: boolean }) {
  return jsonResponse({
    syncedAt: "2026-04-06T12:00:00.000Z",
    records: await Promise.all(
      params.ids.map(async (id, index) => ({
        entityType: "categories",
        entityId: id,
        payload: await sealSyncPayload(JSON.stringify({ id })),
        deleted: false,
        updatedAt: `2026-04-06T12:00:0${index}.000Z`,
        serverVersionToken: `sv:${id}`,
      })),
    ),
    nextSince: params.nextSince,
    hasMore: params.hasMore,
  });
}

async function pullPageWith(records: unknown[], hasMore = false) {
  return jsonResponse({
    syncedAt: "2026-04-06T12:00:00.000Z",
    records,
    hasMore,
  });
}

async function goodRecord(id: string, index = 0) {
  return {
    entityType: "categories",
    entityId: id,
    payload: await sealSyncPayload(JSON.stringify({ id })),
    deleted: false,
    updatedAt: `2026-04-06T12:00:0${index}.000Z`,
    serverVersionToken: `sv:${id}`,
  };
}

function urlsFrom(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe("runHostedSync robustness", () => {
  /* One record the server should not have sent must not stop the account
     syncing. The rest of the page is still good. */
  it("applies the rest of a page when one record is unusable", async () => {
    const repositories = createRepositories([], hostedProfile());

    const fetchMock = vi.fn().mockResolvedValueOnce(
      await pullPageWith([
        await goodRecord("category:1", 0),
        {
          entityType: "somethingThisAppDoesNotKnow",
          entityId: "x1",
          payload: await sealSyncPayload(JSON.stringify({ id: "x1" })),
          deleted: false,
          updatedAt: "2026-04-06T12:00:01.000Z",
          serverVersionToken: "sv:x1",
        },
        await goodRecord("category:2", 2),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runHostedSync({
      repositories,
      profile: hostedProfile(),
      isOnline: true,
    });

    expect(repositories.categories.upsert).toHaveBeenCalledTimes(2);
    expect(result.error).toBeUndefined();
  });

  /* A failure part way through the push must not rewrite items the server
     already confirmed. Their attempt counts drive stuck-row reporting. */
  it("keeps the synced status of a batch that already went through", async () => {
    const items = Array.from({ length: 3 }, (_, index) => pendingItem(index));
    const repositories = createRepositories(items, hostedProfile());

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          syncedAt: "2026-04-06T12:00:00.000Z",
          results: items.map((item) => ({ outboxId: item.id, status: "synced" })),
        }),
      )
      .mockRejectedValueOnce(new Error("network died during the pull"));
    vi.stubGlobal("fetch", fetchMock);

    await runHostedSync({ repositories, profile: hostedProfile(), isOnline: true });

    const outbox = await repositories.syncOutbox.listByUser("u1");
    expect(outbox.map((item) => item.status)).toEqual(["synced", "synced", "synced"]);
    expect(outbox.every((item) => item.attempts === 1)).toBe(true);
  });
});

describe("runHostedSync pull paging", () => {
  it("pulls even when there is nothing queued to push", async () => {
    const repositories = createRepositories([], hostedProfile());

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await pullPage({ ids: ["category:remote"], hasMore: false }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runHostedSync({
      repositories,
      profile: hostedProfile(),
      isOnline: true,
    });

    expect(urlsFrom(fetchMock)).toEqual(["https://sync.example.com/v1/sync/pull"]);
    expect(result.pulled).toBe(1);
    expect(repositories.categories.upsert).toHaveBeenCalledTimes(1);
  });

  it("follows pages until the server stops reporting more", async () => {
    const repositories = createRepositories([], hostedProfile());

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await pullPage({ ids: ["category:1"], nextSince: "c1", hasMore: true }))
      .mockResolvedValueOnce(await pullPage({ ids: ["category:2"], nextSince: "c2", hasMore: true }))
      .mockResolvedValueOnce(await pullPage({ ids: ["category:3"], nextSince: "c3", hasMore: false }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runHostedSync({
      repositories,
      profile: hostedProfile(),
      isOnline: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.pulled).toBe(3);
    expect(repositories.categories.upsert).toHaveBeenCalledTimes(3);
  });

  it("sends each page the cursor from the one before", async () => {
    const repositories = createRepositories([], hostedProfile());

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await pullPage({ ids: ["category:1"], nextSince: "c1", hasMore: true }))
      .mockResolvedValueOnce(await pullPage({ ids: ["category:2"], nextSince: "c2", hasMore: false }));
    vi.stubGlobal("fetch", fetchMock);

    await runHostedSync({ repositories, profile: hostedProfile(), isOnline: true });

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(secondBody.since).toBe("c1");
  });

  it("stores the cursor rather than the server clock", async () => {
    const repositories = createRepositories([], hostedProfile());

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(await pullPage({ ids: ["category:1"], nextSince: "c1", hasMore: false })),
    );

    await runHostedSync({ repositories, profile: hostedProfile(), isOnline: true });

    const saved = await repositories.syncProfiles.getByUser("u1");
    expect(saved?.lastPulledAt).toBe("c1");
  });

  it("stops instead of looping when a server reports more but does not advance", async () => {
    const repositories = createRepositories([], hostedProfile());

    const fetchMock = vi
      .fn()
      .mockResolvedValue(await pullPage({ ids: [], nextSince: undefined, hasMore: true }));
    vi.stubGlobal("fetch", fetchMock);

    await runHostedSync({ repositories, profile: hostedProfile(), isOnline: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("runHostedSync push batching", () => {
  it("splits a large outbox across several requests", async () => {
    const items = Array.from({ length: 250 }, (_, index) => pendingItem(index));
    const repositories = createRepositories(items, hostedProfile());

    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/v1/sync/pull")) {
        return await pullPage({ ids: [], hasMore: false });
      }
      const body = JSON.parse(String(init.body)) as { items: { outboxId: string }[] };
      return jsonResponse({
        syncedAt: "2026-04-06T12:00:00.000Z",
        results: body.items.map((item) => ({ outboxId: item.outboxId, status: "synced" })),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runHostedSync({
      repositories,
      profile: hostedProfile(),
      isOnline: true,
    });

    const pushUrls = urlsFrom(fetchMock).filter((url) => url.endsWith("/v1/sync/push"));
    expect(pushUrls).toHaveLength(2);
    expect(result.attempted).toBe(250);
    expect(result.synced).toBe(250);
  });
});
