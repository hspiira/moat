import { describe, expect, it } from "vitest";

import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncOutboxItem, SyncProfile } from "@/lib/types";
import { backfillSyncOutbox } from "@/lib/sync/backfill";
import { syncableEntityTypes } from "@/lib/sync/entity-sync";

type Seed = {
  userProfile?: { id: string };
  investmentProfile?: { id: string };
  accounts?: { id: string }[];
  transactions?: { id: string }[];
  categories?: { id: string }[];
  outbox?: SyncOutboxItem[];
};

function createProfile(overrides: Partial<SyncProfile> = {}): SyncProfile {
  return {
    id: "sync-profile:u1",
    userId: "u1",
    mode: "hosted_opt_in",
    hostedSyncEnabled: true,
    postgresSyncUrl: "https://sync.example.com",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  };
}

function createRepositories(seed: Seed) {
  const outbox: SyncOutboxItem[] = [...(seed.outbox ?? [])];
  const savedProfiles: SyncProfile[] = [];

  const emptyList = { listByUser: async () => [] };

  const bundle = {
    userProfile: { get: async () => seed.userProfile ?? null },
    investmentProfiles: { getByUser: async () => seed.investmentProfile ?? null },
    accounts: { listByUser: async () => seed.accounts ?? [] },
    transactions: { listByUser: async () => seed.transactions ?? [] },
    categories: { listByUser: async () => seed.categories ?? [] },
    transactionRules: emptyList,
    recurringObligations: emptyList,
    monthCloses: emptyList,
    counterparties: emptyList,
    goals: emptyList,
    budgets: emptyList,
    items: emptyList,
    plannedPurchases: emptyList,
    transactionLineItems: emptyList,
    syncOutbox: {
      listByUser: async () => outbox,
      upsert: async (item: SyncOutboxItem) => {
        outbox.push(item);
        return item;
      },
    },
    syncProfiles: {
      save: async (profile: SyncProfile) => {
        savedProfiles.push(profile);
        return profile;
      },
    },
  } as unknown as RepositoryBundle;

  return { bundle, outbox, savedProfiles };
}

describe("backfillSyncOutbox", () => {
  it("queues records that were written before sync was turned on", async () => {
    const { bundle, outbox } = createRepositories({
      userProfile: { id: "u1" },
      accounts: [{ id: "account:1" }, { id: "account:2" }],
      transactions: [{ id: "transaction:1" }],
    });

    const summary = await backfillSyncOutbox({ repositories: bundle, profile: createProfile() });

    expect(summary.queued).toBe(4);
    expect(outbox).toHaveLength(4);
    expect(outbox.every((item) => item.status === "pending")).toBe(true);
    expect(outbox.every((item) => item.operation === "upsert")).toBe(true);
  });

  it("records the full entity as the payload", async () => {
    const { bundle, outbox } = createRepositories({
      accounts: [{ id: "account:1", name: "MTN MoMo" } as { id: string }],
    });

    await backfillSyncOutbox({ repositories: bundle, profile: createProfile() });

    expect(JSON.parse(outbox[0].payload)).toEqual({ id: "account:1", name: "MTN MoMo" });
  });

  it("marks the profile so it does not run twice", async () => {
    const { bundle, savedProfiles } = createRepositories({ accounts: [{ id: "account:1" }] });

    await backfillSyncOutbox({ repositories: bundle, profile: createProfile() });

    expect(savedProfiles.at(-1)?.backfilledAt).toBeDefined();
  });

  it("refuses to run again once the profile is marked", async () => {
    const { bundle, outbox } = createRepositories({ accounts: [{ id: "account:1" }] });

    const summary = await backfillSyncOutbox({
      repositories: bundle,
      profile: createProfile({ backfilledAt: "2026-04-06T00:00:00.000Z" }),
    });

    expect(summary.queued).toBe(0);
    expect(summary.skippedReason).toContain("already run");
    expect(outbox).toHaveLength(0);
  });

  it("does not double-queue what the outbox already holds", async () => {
    const existing: SyncOutboxItem = {
      id: "sync-outbox:existing",
      userId: "u1",
      entityType: "accounts",
      entityId: "account:1",
      operation: "upsert",
      payload: "{\"id\":\"account:1\"}",
      status: "pending",
      attempts: 0,
      queuedAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    };

    const { bundle, outbox } = createRepositories({
      accounts: [{ id: "account:1" }, { id: "account:2" }],
      outbox: [existing],
    });

    const summary = await backfillSyncOutbox({ repositories: bundle, profile: createProfile() });

    expect(summary.queued).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(outbox).toHaveLength(2);
  });

  it("does nothing when hosted sync is off", async () => {
    const { bundle, outbox } = createRepositories({ accounts: [{ id: "account:1" }] });

    const summary = await backfillSyncOutbox({
      repositories: bundle,
      profile: createProfile({ mode: "local_only", hostedSyncEnabled: false }),
    });

    expect(summary.queued).toBe(0);
    expect(summary.skippedReason).toContain("not enabled");
    expect(outbox).toHaveLength(0);
  });

  it("skips a profile belonging to another user", async () => {
    const { bundle, outbox } = createRepositories({ userProfile: { id: "someone-else" } });

    await backfillSyncOutbox({ repositories: bundle, profile: createProfile() });

    expect(outbox).toHaveLength(0);
  });

  it("reports progress once per store", async () => {
    const { bundle } = createRepositories({ accounts: [{ id: "account:1" }] });
    const seen: number[] = [];

    await backfillSyncOutbox({
      repositories: bundle,
      profile: createProfile(),
      onProgress: (progress) => seen.push(progress.storesDone),
    });

    expect(seen).toHaveLength(syncableEntityTypes.length);
    expect(seen.at(-1)).toBe(syncableEntityTypes.length);
  });
});
