import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  IdMigrationError,
  MIGRATION_LOCK_MS,
  migrateIdsToCuid2,
} from "@/lib/app-state/id-migration";
import {
  createMemoryJournalStore,
  type IdMigrationJournalStore,
} from "@/lib/app-state/id-migration-journal";
import { idReferences } from "@/lib/app-state/id-references";
import { isValidId, deriveSeededId } from "@/lib/ids";
import { SEEDED_SLUGS, categorySlug } from "@/lib/domain/seeded-ids";
import type { RepositoryBundle } from "@/lib/repositories/types";

type Store = Record<string, unknown> & { id: string };

type Seed = Partial<Record<string, Store[]>>;

function createRepositories(
  seed: Seed,
  options: {
    syncProfile?: Record<string, unknown>;
    failAfter?: { store: string; calls: number };
    failRemoveAfter?: { store: string; calls: number };
  } = {},
) {
  const data = new Map<string, Store[]>(Object.entries(seed).map(([k, v]) => [k, [...(v ?? [])]]));
  let syncProfile = options.syncProfile ?? null;
  const writes = new Map<string, number>();
  const removals = new Map<string, number>();

  const repositoryFor = (store: string) => ({
    listByUser: async (userId: string) =>
      (data.get(store) ?? []).filter((row) => row.userId === undefined || row.userId === userId),
    upsert: async (record: Store) => {
      const seen = (writes.get(store) ?? 0) + 1;
      writes.set(store, seen);
      if (options.failAfter && options.failAfter.store === store && seen > options.failAfter.calls) {
        throw new Error(`Storage died writing ${store}.`);
      }
      const rows = data.get(store) ?? [];
      const index = rows.findIndex((row) => row.id === record.id);
      if (index >= 0) rows[index] = record;
      else rows.push(record);
      data.set(store, rows);
      return record;
    },
    remove: async (id: string) => {
      const seen = (removals.get(store) ?? 0) + 1;
      removals.set(store, seen);
      const limit = options.failRemoveAfter;
      if (limit && limit.store === store && seen > limit.calls) {
        throw new Error(`Storage died clearing ${store}.`);
      }
      data.set(store, (data.get(store) ?? []).filter((row) => row.id !== id));
    },
    getById: async (id: string) => (data.get(store) ?? []).find((row) => row.id === id) ?? null,
  });

  const stores = [
    "accounts", "categories", "counterparties", "items", "imports", "captureEnvelopes",
    "transactions", "transactionLineItems", "plannedPurchases", "goals", "budgets",
    "monthCloses", "recurringObligations", "transactionRules", "captureReviewItems",
    "correctionLogs", "syncOutbox",
  ];

  const bundle: Record<string, unknown> = {};
  for (const store of stores) bundle[store] = repositoryFor(store);

  bundle.userProfile = {
    get: async () => data.get("userProfiles")?.[0] ?? null,
    save: async (record: Store) => {
      data.set("userProfiles", [record]);
      return record;
    },
  };
  bundle.investmentProfiles = {
    getByUser: async () => data.get("investmentProfiles")?.[0] ?? null,
    save: async (record: Store) => {
      data.set("investmentProfiles", [record]);
      return record;
    },
  };
  bundle.syncProfiles = {
    getByUser: async () => syncProfile,
    save: async (record: Record<string, unknown>) => {
      syncProfile = record;
      return record;
    },
  };

  return { bundle: bundle as unknown as RepositoryBundle, data, syncProfile: () => syncProfile };
}

const baseSeed = (): Seed => ({
  userProfiles: [{ id: "user:default", displayName: "Ada" }],
  accounts: [
    { id: "account:money-lent-out", userId: "user:default", name: "Money lent out" },
    { id: "account:abc", userId: "user:default", name: "MTN MoMo" },
  ],
  categories: [
    { id: "category:food", userId: "user:default", name: "Food", isDefault: true },
    { id: "category:mine", userId: "user:default", name: "Chai", isDefault: false },
  ],
  transactions: [
    {
      id: "transaction:1",
      userId: "user:default",
      accountId: "account:abc",
      categoryId: "category:food",
    },
  ],
});

const BACKED_UP_AT = "2026-08-19T00:00:00.000Z";

function migrate(
  bundle: RepositoryBundle,
  overrides: {
    userId?: string;
    backupTakenAt?: string | null;
    journalStore?: IdMigrationJournalStore;
    dryRun?: boolean;
    now?: Date;
  } = {},
) {
  return migrateIdsToCuid2({
    repositories: bundle,
    userId: "user:default",
    backupTakenAt: BACKED_UP_AT,
    journalStore: createMemoryJournalStore(),
    ...overrides,
  });
}


const resumeSeed = (): Seed => ({
  userProfiles: [{ id: "user:default", name: "Ada" }],
  accounts: [
    { id: "account:money-lent-out", userId: "user:default", name: "Money lent out" },
    { id: "account:abc", userId: "user:default", name: "MTN MoMo" },
    { id: "account:bank", userId: "user:default", name: "Town Bank" },
  ],
  categories: [
    { id: "category:food", userId: "user:default", name: "Food", isDefault: true },
    { id: "category:mine", userId: "user:default", name: "Chai", isDefault: false },
  ],
  transactions: [
    {
      id: "transaction:1",
      userId: "user:default",
      name: "Market",
      accountId: "account:abc",
      categoryId: "category:food",
      amount: -2000,
    },
    {
      id: "transaction:2",
      userId: "user:default",
      name: "Move out",
      accountId: "account:bank",
      categoryId: "category:mine",
      amount: -150000,
      transferGroupId: "transfer:9",
    },
    {
      id: "transaction:3",
      userId: "user:default",
      name: "Move in",
      accountId: "account:abc",
      categoryId: "category:mine",
      amount: 150000,
      transferGroupId: "transfer:9",
    },
  ],
});

function canonicalLedger(data: Map<string, Store[]>): string {
  const label = new Map<string, string>();
  for (const [store, rows] of data) {
    for (const row of rows) label.set(row.id, `${store}:${String(row.name)}`);
  }

  const groups = new Map<string, string>();
  const lines: string[] = [];

  for (const store of [...data.keys()].sort()) {
    const rows = [...(data.get(store) ?? [])].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );

    for (const row of rows) {
      const fields = Object.entries(row)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          if (typeof value !== "string") return `${key}=${JSON.stringify(value)}`;
          if (key === "transferGroupId") {
            if (!groups.has(value)) groups.set(value, `group#${groups.size}`);
            return `${key}=${groups.get(value)}`;
          }
          if (label.has(value)) return `${key}=${label.get(value)}`;
          return `${key}=${isValidId(value) ? "<cuid2>" : value}`;
        });
      lines.push(`${store}|${fields.join(",")}`);
    }
  }

  return lines.join("\n");
}

describe("migrateIdsToCuid2", () => {
  it("gives every record a cuid2 id", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    const summary = await migrate(bundle);

    expect(summary.migrated).toBe(true);
    for (const rows of data.values()) {
      for (const row of rows) {
        expect(isValidId(row.id)).toBe(true);
      }
    }
  });

  it("repoints references at the new ids", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrate(bundle);

    const account = data.get("accounts")!.find((row) => row.name === "MTN MoMo")!;
    const category = data.get("categories")!.find((row) => row.name === "Food")!;
    const transaction = data.get("transactions")![0];

    expect(transaction.accountId).toBe(account.id);
    expect(transaction.categoryId).toBe(category.id);
  });

  it("gives seeded records their derived id so two devices converge", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrate(bundle);

    const newUserId = data.get("userProfiles")![0].id;
    const pool = data.get("accounts")!.find((row) => row.name === "Money lent out")!;
    const food = data.get("categories")!.find((row) => row.name === "Food")!;

    expect(pool.id).toBe(deriveSeededId(newUserId, SEEDED_SLUGS.lendingPool));
    expect(food.id).toBe(deriveSeededId(newUserId, categorySlug("Food")));
  });

  it("gives a user-made category a random id even when its name matches a default", async () => {
    const seed = baseSeed();
    seed.categories!.push({
      id: "category:food-2",
      userId: "user:default",
      name: "Food",
      isDefault: false,
    });
    const { bundle, data } = createRepositories(seed);

    await migrate(bundle);

    const newUserId = data.get("userProfiles")![0].id;
    const derived = deriveSeededId(newUserId, categorySlug("Food"));
    const named = data.get("categories")!.filter((row) => row.name === "Food");

    expect(named).toHaveLength(2);
    expect(named.filter((row) => row.id === derived)).toHaveLength(1);
  });

  it("repoints userId onto the new profile id", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrate(bundle);

    const newUserId = data.get("userProfiles")![0].id;
    expect(isValidId(newUserId)).toBe(true);
    for (const store of ["accounts", "categories", "transactions"]) {
      for (const row of data.get(store)!) {
        expect(row.userId).toBe(newUserId);
      }
    }
  });

  it("rewrites ids nested inside a capture snapshot", async () => {
    const seed = baseSeed();
    seed.captureEnvelopes = [{ id: "capture-envelope:1", userId: "user:default" }];
    seed.captureReviewItems = [
      {
        id: "capture-review:1",
        userId: "user:default",
        envelopeId: "capture-envelope:1",
        accountId: "account:abc",
        categoryId: "category:food",
        originalSnapshot: { accountId: "account:abc", categoryId: "category:food" },
      },
    ];
    const { bundle, data } = createRepositories(seed);

    await migrate(bundle);

    const account = data.get("accounts")!.find((row) => row.name === "MTN MoMo")!;
    const review = data.get("captureReviewItems")![0];
    const snapshot = review.originalSnapshot as Record<string, unknown>;

    expect(snapshot.accountId).toBe(account.id);
    expect(review.accountId).toBe(account.id);
  });

  it("keeps both legs of a transfer on one new group id", async () => {
    const seed = baseSeed();
    seed.transactions = [
      { id: "t:1", userId: "user:default", accountId: "account:abc", categoryId: "category:food", transferGroupId: "transfer:9" },
      { id: "t:2", userId: "user:default", accountId: "account:abc", categoryId: "category:food", transferGroupId: "transfer:9" },
    ];
    const { bundle, data } = createRepositories(seed);

    await migrate(bundle);

    const [first, second] = data.get("transactions")!;
    expect(first.transferGroupId).toBe(second.transferGroupId);
    expect(first.transferGroupId).not.toBe("transfer:9");
  });

  it("aborts without writing when a reference cannot be resolved", async () => {
    const seed = baseSeed();
    seed.transactions = [
      { id: "transaction:1", userId: "user:default", accountId: "account:gone", categoryId: "category:food" },
    ];
    const { bundle, data } = createRepositories(seed);

    await expect(
      migrate(bundle),
    ).rejects.toBeInstanceOf(IdMigrationError);

    expect(data.get("userProfiles")![0].id).toBe("user:default");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("leaves an optional reference that was never set alone", async () => {
    const seed = baseSeed();
    seed.goals = [{ id: "goal:1", userId: "user:default", name: "Rent" }];
    const { bundle, data } = createRepositories(seed);

    await migrate(bundle);

    expect(data.get("goals")![0].linkedAccountId).toBeUndefined();
  });

  it("refuses to run once the device has synced", async () => {
    const { bundle, data } = createRepositories(baseSeed(), {
      syncProfile: { id: "sync:1", userId: "user:default", lastSyncedAt: "2026-04-06T00:00:00.000Z" },
    });

    const summary = await migrate(bundle);

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("already synced");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("refuses to run while the outbox still holds queued changes", async () => {
    const seed = baseSeed();
    seed.syncOutbox = [{ id: "sync-outbox:1", userId: "user:default" }];
    const { bundle } = createRepositories(seed);

    const summary = await migrate(bundle);

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("already synced");
  });

  it("is a no-op the second time", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrate(bundle);
    const afterFirst = data.get("transactions")![0].id;

    const second = await migrate(bundle, {
      userId: data.get("userProfiles")![0].id as string,
    });

    expect(second.migrated).toBe(false);
    expect(data.get("transactions")![0].id).toBe(afterFirst);
  });


  it("finishes the same ledger after being killed partway and re-run", async () => {
    const startedAt = new Date("2026-08-19T09:00:00.000Z");
    const laterOn = new Date(startedAt.getTime() + MIGRATION_LOCK_MS + 1_000);

    const clean = createRepositories(resumeSeed());
    await migrate(clean.bundle, { now: startedAt });
    const expected = canonicalLedger(clean.data);

    const failure = { store: "transactions", calls: 2 };
    const interrupted = createRepositories(resumeSeed(), { failAfter: failure });
    const journalStore = createMemoryJournalStore();

    await expect(
      migrate(interrupted.bundle, { journalStore, now: startedAt }),
    ).rejects.toThrow(/Storage died/);
    expect(journalStore.read(), "an interrupted run left no journal").not.toBeNull();

    failure.calls = Number.POSITIVE_INFINITY;
    const second = await migrate(interrupted.bundle, { journalStore, now: laterOn });

    expect(second.migrated).toBe(true);
    expect(second.resumed).toBe(true);
    expect(canonicalLedger(interrupted.data)).toBe(expected);
    expect(journalStore.read(), "a finished run left its journal behind").toBeNull();
  });

  it("keeps both legs of a transfer together when the cleanup is interrupted", async () => {
    const startedAt = new Date("2026-08-19T09:00:00.000Z");
    const failure = { store: "transactions", calls: 1 };
    const { bundle, data } = createRepositories(resumeSeed(), { failRemoveAfter: failure });
    const journalStore = createMemoryJournalStore();

    await expect(
      migrate(bundle, { journalStore, now: startedAt }),
    ).rejects.toThrow(/Storage died clearing/);

    failure.calls = Number.POSITIVE_INFINITY;
    await migrate(bundle, {
      journalStore,
      now: new Date(startedAt.getTime() + MIGRATION_LOCK_MS + 1_000),
    });

    const legs = data.get("transactions")!.filter((row) => row.transferGroupId);
    expect(legs).toHaveLength(2);
    expect(legs[0].transferGroupId).toBe(legs[1].transferGroupId);
    expect(legs[0].transferGroupId).not.toBe("transfer:9");
  });

  it("leaves no duplicate behind after an interruption", async () => {
    const startedAt = new Date("2026-08-19T09:00:00.000Z");
    const failure = { store: "transactions", calls: 2 };
    const { bundle, data } = createRepositories(resumeSeed(), { failAfter: failure });
    const journalStore = createMemoryJournalStore();

    await expect(
      migrate(bundle, { journalStore, now: startedAt }),
    ).rejects.toThrow(/Storage died/);

    failure.calls = Number.POSITIVE_INFINITY;
    await migrate(bundle, {
      journalStore,
      now: new Date(startedAt.getTime() + MIGRATION_LOCK_MS + 1_000),
    });

    for (const [store, rows] of data) {
      const ids = rows.map((row) => row.id);
      expect(new Set(ids).size, `${store} holds a duplicate id`).toBe(ids.length);
      for (const row of rows) {
        expect(isValidId(row.id), `${store} still holds an old id`).toBe(true);
      }
    }
    expect(data.get("transactions")).toHaveLength(3);
  });

  it("refuses to start without a backup", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    const summary = await migrate(bundle, { backupTakenAt: null });

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("Take an encrypted backup");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("refuses when the backup is older than the newest change", async () => {
    const seed = baseSeed();
    seed.transactions![0].updatedAt = "2026-08-20T00:00:00.000Z";
    const { bundle, data } = createRepositories(seed);

    const summary = await migrate(bundle, { backupTakenAt: "2026-08-19T00:00:00.000Z" });

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("older than your most recent change");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("runs when the backup is newer than the newest change", async () => {
    const seed = baseSeed();
    seed.transactions![0].updatedAt = "2026-08-18T00:00:00.000Z";
    const { bundle } = createRepositories(seed);

    const summary = await migrate(bundle, { backupTakenAt: "2026-08-19T00:00:00.000Z" });

    expect(summary.migrated).toBe(true);
  });

  it("reports what a dry run would change without writing any of it", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    const summary = await migrate(bundle, { dryRun: true, backupTakenAt: null });

    expect(summary.migrated).toBe(false);
    expect(summary.dryRun).toBe(true);
    expect(summary.recordsRewritten).toBe(6);
    expect(summary.referencesRewritten).toBeGreaterThan(0);
    expect(data.get("userProfiles")![0].id).toBe("user:default");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("refuses while another run holds the journal", async () => {
    const startedAt = new Date("2026-08-19T09:00:00.000Z");
    const { bundle, data } = createRepositories(baseSeed());
    const journalStore = createMemoryJournalStore({
      userId: "user:default",
      newUserId: "kx9wq3m2p1v7t8h4n6c0dzab",
      startedAt: startedAt.toISOString(),
      idMap: {},
      groupIdMap: {},
      storesWritten: [],
    });

    const summary = await migrate(bundle, {
      journalStore,
      now: new Date(startedAt.getTime() + 1_000),
    });

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("Another migration is already running");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("drops the old rows rather than leaving duplicates", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrate(bundle);

    expect(data.get("accounts")).toHaveLength(2);
    expect(data.get("categories")).toHaveLength(2);
    expect(data.get("transactions")).toHaveLength(1);
  });
});

describe("id reference map", () => {
  it("covers every id-shaped field in lib/types.ts", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/types.ts"), "utf8");

    const declared = new Set(
      Object.values(idReferences)
        .flat()
        .map((reference) => reference.path.split(".").pop() as string),
    );

    const exempt = new Set([
      "userId", // rewritten directly, not through the map
      "id",
      "entityId", // sync outbox, which must be empty before migrating
      "deviceId", // identifies a device, not a record
      "transferGroupId", // grouping key, remapped on its own
      "lineItemId", // derived view types, never stored
      "goalId",
      "partyKey",
      "budgetId",
    ]);

    const found = [...source.matchAll(/^\s{2}([a-zA-Z]*[Ii]d)\??: string/gm)].map(
      (match) => match[1],
    );

    const missing = [...new Set(found)].filter(
      (field) => !declared.has(field) && !exempt.has(field),
    );

    expect(missing).toEqual([]);
  });
});
