import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { openFinanceDatabase } from "@/lib/repositories/indexeddb/client";
import type { StoreName } from "@/lib/repositories/store-names";
import { createSqliteRepositories } from "@/lib/repositories/sqlite";
import type { SqliteClient } from "@/lib/repositories/sqlite/client";
import type { RepositoryBundle } from "@/lib/repositories/types";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import type { Account, ResourceLink, SyncProfile } from "@/lib/types";

function makeAccount(overrides: Partial<Account> & { id: string; userId: string }): Account {
  return {
    name: "Cash",
    type: "cash",
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides,
  } as Account;
}

function makeSyncProfile(userId: string, hostedSyncEnabled: boolean): SyncProfile {
  return {
    id: `sync-profile:${userId}`,
    userId,
    mode: hostedSyncEnabled ? "hosted_opt_in" : "local_only",
    hostedSyncEnabled,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
  };
}

function makeResource(id: string): ResourceLink {
  return {
    id,
    title: "Guide",
    sourceName: "Bank of Uganda",
    url: "https://example.test",
    topic: "savings",
    isOfficial: true,
  };
}

function makeUnreadableEnvelope(id: string) {
  return {
    id,
    __moatEncrypted: true as const,
    __moatEnvelopeVersion: 2,
    iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "AAAAAAAAAAAAAAAA",
  };
}

type Harness = {
  bundle: RepositoryBundle;
  injectRaw: (store: StoreName, id: string, raw: unknown) => Promise<void>;
};

type SqliteRow = Record<string, unknown> & { id: string };

class InMemorySqliteClient implements SqliteClient {
  private stores = new Map<StoreName, Map<string, unknown>>();

  private getStore(store: StoreName) {
    let records = this.stores.get(store);
    if (!records) {
      records = new Map();
      this.stores.set(store, records);
    }
    return records;
  }

  private rows(store: StoreName): SqliteRow[] {
    return [...this.getStore(store).values()].filter(
      (record): record is SqliteRow =>
        typeof record === "object" && record !== null && "id" in record,
    );
  }

  inject(store: StoreName, id: string, raw: unknown) {
    this.getStore(store).set(id, raw);
  }

  async getById<T>(store: StoreName, id: string): Promise<T | null> {
    return (this.getStore(store).get(id) as T | undefined) ?? null;
  }

  async listAll<T>(store: StoreName): Promise<T[]> {
    return [...this.getStore(store).values()] as T[];
  }

  async listByUser<T>(store: StoreName, userId: string): Promise<T[]> {
    return this.rows(store).filter((record) => record.userId === userId) as T[];
  }

  async listByFieldPrefix<T>(
    store: StoreName,
    field: string,
    prefix: string,
    userId?: string,
  ): Promise<T[]> {
    return this.rows(store).filter((record) => {
      const value = record[field];
      if (typeof value !== "string" || !value.startsWith(prefix)) {
        return false;
      }
      return userId ? record.userId === userId : true;
    }) as T[];
  }

  async listByFields<T>(
    store: StoreName,
    filters: Array<{ field: string; value: string | number | boolean }>,
  ): Promise<T[]> {
    return this.rows(store).filter((record) =>
      filters.every((filter) => record[filter.field] === filter.value),
    ) as T[];
  }

  async listByFieldIn<T>(
    store: StoreName,
    field: string,
    values: Array<string | number | boolean>,
    userId?: string,
  ): Promise<T[]> {
    return this.rows(store).filter((record) => {
      if (!values.includes(record[field] as string | number | boolean)) {
        return false;
      }
      return userId ? record.userId === userId : true;
    }) as T[];
  }

  async upsert<T extends Record<string, unknown>>(store: StoreName, record: T): Promise<T> {
    this.getStore(store).set(String(record.id), record);
    return record;
  }

  async remove(store: StoreName, id: string): Promise<void> {
    this.getStore(store).delete(id);
  }

  async replaceAll<T extends Record<string, unknown>>(store: StoreName, records: T[]): Promise<T[]> {
    const map = this.getStore(store);
    map.clear();
    records.forEach((record) => map.set(String(record.id), record));
    return records;
  }
}

async function clearIndexedDb() {
  const database = await openFinanceDatabase();
  const names = [...database.objectStoreNames];
  if (names.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(names, "readwrite");
      names.forEach((name) => transaction.objectStore(name).clear());
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  database.close();
}

async function injectRawIndexedDb(store: StoreName, _id: string, raw: unknown) {
  const database = await openFinanceDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(raw as { id: string });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const backends: Array<{ name: string; create: () => Promise<Harness>; reset: () => Promise<void> }> =
  [
    {
      name: "indexeddb",
      reset: async () => {
        setActiveRecordCryptoKey(null);
        await clearIndexedDb();
      },
      create: async () => {
        const bundle = createIndexedDbRepositories();
        return { bundle, injectRaw: injectRawIndexedDb };
      },
    },
    {
      name: "sqlite",
      reset: async () => {},
      create: async () => {
        const client = new InMemorySqliteClient();
        const bundle = createSqliteRepositories(client);
        return {
          bundle,
          injectRaw: async (store, id, raw) => client.inject(store, id, raw),
        };
      },
    },
  ];

describe.each(backends)("repository contract: $name", (backend) => {
  let harness: Harness;

  beforeEach(async () => {
    await backend.reset();
    harness = await backend.create();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a record through upsert, getById, and remove", async () => {
    const account = makeAccount({ id: "acc-1", userId: "u1", balance: 15000 });
    const saved = await harness.bundle.accounts.upsert(account);
    expect(saved).toMatchObject({ id: "acc-1", userId: "u1", balance: 15000 });

    await expect(harness.bundle.accounts.getById("acc-1")).resolves.toMatchObject({
      id: "acc-1",
      balance: 15000,
    });

    await harness.bundle.accounts.remove("acc-1");
    await expect(harness.bundle.accounts.getById("acc-1")).resolves.toBeNull();
  });

  it("scopes listByUser to the requested user", async () => {
    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-1", userId: "u1" }));
    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-2", userId: "u1" }));
    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-3", userId: "u2" }));

    const forUser1 = await harness.bundle.accounts.listByUser("u1");
    expect(forUser1.map((account) => account.id).sort()).toEqual(["acc-1", "acc-2"]);

    const forUser2 = await harness.bundle.accounts.listByUser("u2");
    expect(forUser2.map((account) => account.id)).toEqual(["acc-3"]);
  });

  it("enqueues an outbox mutation when hosted sync is enabled for a synced store", async () => {
    await harness.bundle.syncProfiles.save(makeSyncProfile("u1", true));

    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-1", userId: "u1" }));

    const pending = await harness.bundle.syncOutbox.listPendingByUser("u1");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      entityType: "accounts",
      entityId: "acc-1",
      operation: "upsert",
      status: "pending",
    });
  });

  it("does not enqueue mutations for an unsynced store even with hosted sync on", async () => {
    await harness.bundle.syncProfiles.save(makeSyncProfile("u1", true));

    await harness.bundle.captureEnvelopes.upsert({
      id: "env-1",
      userId: "u1",
    } as never);

    const pending = await harness.bundle.syncOutbox.listPendingByUser("u1");
    expect(pending).toHaveLength(0);
  });

  it("does not enqueue mutations when hosted sync is disabled", async () => {
    await harness.bundle.syncProfiles.save(makeSyncProfile("u1", false));

    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-1", userId: "u1" }));

    const pending = await harness.bundle.syncOutbox.listPendingByUser("u1");
    expect(pending).toHaveLength(0);
  });

  it("does not enqueue mutations when the sync mode is local_only", async () => {
    await harness.bundle.syncProfiles.save({
      ...makeSyncProfile("u1", true),
      mode: "local_only",
    });

    await harness.bundle.accounts.upsert(makeAccount({ id: "acc-1", userId: "u1" }));

    const pending = await harness.bundle.syncOutbox.listPendingByUser("u1");
    expect(pending).toHaveLength(0);
  });

  it("skips an unreadable record instead of failing the whole read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await harness.bundle.resources.replaceAll([makeResource("res-good")]);
    const badRecord =
      backend.name === "indexeddb" ? makeUnreadableEnvelope("res-bad") : "not-an-object";
    await harness.injectRaw("resources", "res-bad", badRecord);

    const resources = await harness.bundle.resources.list();
    expect(resources.map((resource) => resource.id)).toEqual(["res-good"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("skipped an unreadable resources record"),
      expect.anything(),
    );
  });
});

describe("repository contract: indexeddb with an active record key", () => {
  beforeEach(async () => {
    setActiveRecordCryptoKey(null);
    await clearIndexedDb();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    setActiveRecordCryptoKey(key);
  });

  afterEach(() => {
    setActiveRecordCryptoKey(null);
  });

  function makeTransaction(id: string, occurredOn: string) {
    return {
      id,
      userId: "u1",
      accountId: "acc-1",
      type: "expense",
      amount: 1200,
      currency: "UGX",
      originalAmount: 1200,
      occurredOn,
      categoryId: "cat-1",
      reconciliationState: "posted",
      source: "manual",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    } as never;
  }

  async function readStoredRecord(store: StoreName, id: string): Promise<unknown> {
    const database = await openFinanceDatabase();
    const record = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(store, "readonly");
      const request = transaction.objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return record;
  }

  it("stores encrypted envelopes and queries through blinded indexes", async () => {
    const bundle = createIndexedDbRepositories();

    await bundle.transactions.upsert(makeTransaction("tx-1", "2026-04-05"));
    await bundle.transactions.upsert(makeTransaction("tx-2", "2026-03-31"));

    const stored = await readStoredRecord("transactions", "tx-1");
    expect(stored).toMatchObject({ id: "tx-1", __moatEncrypted: true });
    expect(JSON.stringify(stored)).not.toContain("2026-04-05");

    await expect(bundle.transactions.getById("tx-1")).resolves.toMatchObject({
      id: "tx-1",
      occurredOn: "2026-04-05",
    });

    const forUser = await bundle.transactions.listByUser("u1");
    expect(forUser.map((transaction) => transaction.id).sort()).toEqual(["tx-1", "tx-2"]);

    const forMonth = await bundle.transactions.listByMonth("u1", "2026-04");
    expect(forMonth.map((transaction) => transaction.id)).toEqual(["tx-1"]);
  });
});
