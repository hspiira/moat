import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { IdMigrationError, migrateIdsToCuid2 } from "@/lib/app-state/id-migration";
import { idReferences } from "@/lib/app-state/id-references";
import { isValidId, deriveSeededId } from "@/lib/ids";
import { SEEDED_SLUGS, categorySlug } from "@/lib/domain/seeded-ids";
import type { RepositoryBundle } from "@/lib/repositories/types";

type Store = Record<string, unknown> & { id: string };

type Seed = Partial<Record<string, Store[]>>;

function createRepositories(seed: Seed, options: { syncProfile?: Record<string, unknown> } = {}) {
  const data = new Map<string, Store[]>(Object.entries(seed).map(([k, v]) => [k, [...(v ?? [])]]));
  let syncProfile = options.syncProfile ?? null;

  const repositoryFor = (store: string) => ({
    listByUser: async () => [...(data.get(store) ?? [])],
    upsert: async (record: Store) => {
      const rows = data.get(store) ?? [];
      const index = rows.findIndex((row) => row.id === record.id);
      if (index >= 0) rows[index] = record;
      else rows.push(record);
      data.set(store, rows);
      return record;
    },
    remove: async (id: string) => {
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

describe("migrateIdsToCuid2", () => {
  it("gives every record a cuid2 id", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    const summary = await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    expect(summary.migrated).toBe(true);
    for (const rows of data.values()) {
      for (const row of rows) {
        expect(isValidId(row.id)).toBe(true);
      }
    }
  });

  it("repoints references at the new ids", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    const account = data.get("accounts")!.find((row) => row.name === "MTN MoMo")!;
    const category = data.get("categories")!.find((row) => row.name === "Food")!;
    const transaction = data.get("transactions")![0];

    expect(transaction.accountId).toBe(account.id);
    expect(transaction.categoryId).toBe(category.id);
  });

  it("gives seeded records their derived id so two devices converge", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

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

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    const newUserId = data.get("userProfiles")![0].id;
    const derived = deriveSeededId(newUserId, categorySlug("Food"));
    const named = data.get("categories")!.filter((row) => row.name === "Food");

    expect(named).toHaveLength(2);
    expect(named.filter((row) => row.id === derived)).toHaveLength(1);
  });

  it("repoints userId onto the new profile id", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

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

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

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

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

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
      migrateIdsToCuid2({ repositories: bundle, userId: "user:default" }),
    ).rejects.toBeInstanceOf(IdMigrationError);

    expect(data.get("userProfiles")![0].id).toBe("user:default");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("leaves an optional reference that was never set alone", async () => {
    const seed = baseSeed();
    seed.goals = [{ id: "goal:1", userId: "user:default", name: "Rent" }];
    const { bundle, data } = createRepositories(seed);

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    expect(data.get("goals")![0].linkedAccountId).toBeUndefined();
  });

  it("refuses to run once the device has synced", async () => {
    const { bundle, data } = createRepositories(baseSeed(), {
      syncProfile: { id: "sync:1", userId: "user:default", lastSyncedAt: "2026-04-06T00:00:00.000Z" },
    });

    const summary = await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("already synced");
    expect(data.get("transactions")![0].id).toBe("transaction:1");
  });

  it("refuses to run while the outbox still holds queued changes", async () => {
    const seed = baseSeed();
    seed.syncOutbox = [{ id: "sync-outbox:1", userId: "user:default" }];
    const { bundle } = createRepositories(seed);

    const summary = await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    expect(summary.migrated).toBe(false);
    expect(summary.reason).toContain("already synced");
  });

  it("is a no-op the second time", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });
    const afterFirst = data.get("transactions")![0].id;

    const second = await migrateIdsToCuid2({
      repositories: bundle,
      userId: data.get("userProfiles")![0].id as string,
    });

    expect(second.migrated).toBe(false);
    expect(data.get("transactions")![0].id).toBe(afterFirst);
  });

  it("drops the old rows rather than leaving duplicates", async () => {
    const { bundle, data } = createRepositories(baseSeed());

    await migrateIdsToCuid2({ repositories: bundle, userId: "user:default" });

    expect(data.get("accounts")).toHaveLength(2);
    expect(data.get("categories")).toHaveLength(2);
    expect(data.get("transactions")).toHaveLength(1);
  });
});

/**
 * The map is hand-written, so this guards the failure mode that matters: a new
 * reference field added to lib/types.ts and forgotten here would keep an id
 * that no longer resolves.
 */
describe("id reference map", () => {
  it("covers every id-shaped field in lib/types.ts", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/types.ts"), "utf8");

    const declared = new Set(
      Object.values(idReferences)
        .flat()
        .map((reference) => reference.path.split(".").pop() as string),
    );

    // Fields that hold an id but are deliberately not remapped.
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
