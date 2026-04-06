import { describe, expect, it } from "vitest";

import type { StoreName } from "@/lib/repositories/indexeddb/client";
import { createSqliteRepositories } from "@/lib/repositories/sqlite";

type SqliteRecord = Record<string, unknown> & { id: string };

class InMemorySqliteClient {
  private stores = new Map<StoreName, Map<string, SqliteRecord>>();

  private getStore(store: StoreName) {
    let records = this.stores.get(store);
    if (!records) {
      records = new Map();
      this.stores.set(store, records);
    }
    return records;
  }

  async getById<T>(store: StoreName, id: string): Promise<T | null> {
    return (this.getStore(store).get(id) as T | undefined) ?? null;
  }

  async listAll<T>(store: StoreName): Promise<T[]> {
    return [...this.getStore(store).values()] as T[];
  }

  async listByUser<T>(store: StoreName, userId: string): Promise<T[]> {
    return [...this.getStore(store).values()].filter((record) => record.userId === userId) as T[];
  }

  async listByField<T>(
    store: StoreName,
    field: string,
    value: string | number | boolean,
  ): Promise<T[]> {
    return [...this.getStore(store).values()].filter((record) => record[field] === value) as T[];
  }

  async listByFieldPrefix<T>(
    store: StoreName,
    field: string,
    prefix: string,
    userId?: string,
  ): Promise<T[]> {
    return [...this.getStore(store).values()].filter((record) => {
      const fieldValue = record[field];
      if (typeof fieldValue !== "string" || !fieldValue.startsWith(prefix)) {
        return false;
      }
      return userId ? record.userId === userId : true;
    }) as T[];
  }

  async listByFields<T>(
    store: StoreName,
    filters: Array<{
      field: string;
      value: string | number | boolean;
    }>,
  ): Promise<T[]> {
    return [...this.getStore(store).values()].filter((record) =>
      filters.every((filter) => record[filter.field] === filter.value),
    ) as T[];
  }

  async listByFieldIn<T>(
    store: StoreName,
    field: string,
    values: Array<string | number | boolean>,
    userId?: string,
  ): Promise<T[]> {
    return [...this.getStore(store).values()].filter((record) => {
      if (!values.includes(record[field] as string | number | boolean)) {
        return false;
      }
      return userId ? record.userId === userId : true;
    }) as T[];
  }

  async upsert<T extends Record<string, unknown>>(store: StoreName, record: T): Promise<T> {
    this.getStore(store).set(String(record.id), record as SqliteRecord);
    return record;
  }

  async remove(store: StoreName, id: string): Promise<void> {
    this.getStore(store).delete(id);
  }

  async replaceAll<T extends Record<string, unknown>>(store: StoreName, records: T[]): Promise<T[]> {
    const map = this.getStore(store);
    map.clear();
    records.forEach((record) => map.set(String(record.id), record as SqliteRecord));
    return records;
  }
}

describe("sqlite repository bundle", () => {
  it("matches the repository contract for CRUD and indexed lookup helpers", async () => {
    const client = new InMemorySqliteClient();
    const repositories = createSqliteRepositories(client);

    await repositories.accounts.upsert({
      id: "account-1",
      userId: "u1",
      name: "Cash",
      type: "cash",
      openingBalance: 0,
      balance: 15000,
      isArchived: false,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.transactions.upsert({
      id: "tx-1",
      userId: "u1",
      accountId: "account-1",
      type: "expense",
      amount: 1200,
      currency: "UGX",
      originalAmount: 1200,
      occurredOn: "2026-04-05",
      categoryId: "cat-1",
      reconciliationState: "posted",
      source: "manual",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.transactions.upsert({
      id: "tx-2",
      userId: "u1",
      accountId: "account-1",
      type: "expense",
      amount: 900,
      currency: "UGX",
      originalAmount: 900,
      occurredOn: "2026-03-31",
      categoryId: "cat-1",
      reconciliationState: "posted",
      source: "manual",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.monthCloses.upsert({
      id: "close-1",
      userId: "u1",
      period: "2026-04",
      state: "closed",
      unresolvedTransactions: 0,
      duplicateAlerts: 0,
      missingCategoryCount: 0,
      closedAt: "2026-04-30T23:59:59.000Z",
      createdAt: "2026-04-30T23:59:59.000Z",
      updatedAt: "2026-04-30T23:59:59.000Z",
    });
    await repositories.categories.upsert({
      id: "cat-1",
      userId: "u1",
      name: "Food",
      kind: "expense",
      isDefault: true,
      createdAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.categories.upsert({
      id: "cat-2",
      userId: "u1",
      name: "Custom",
      kind: "expense",
      isDefault: false,
      createdAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.budgets.upsert({
      id: "budget-1",
      userId: "u1",
      month: "2026-04",
      categoryId: "cat-1",
      targetAmount: 10000,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    await repositories.syncOutbox.upsert({
      id: "outbox-1",
      userId: "u1",
      entityType: "transactions",
      entityId: "tx-1",
      operation: "upsert",
      payload: "{}",
      status: "pending",
      attempts: 0,
      queuedAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });
    await repositories.syncOutbox.upsert({
      id: "outbox-2",
      userId: "u1",
      entityType: "transactions",
      entityId: "tx-2",
      operation: "upsert",
      payload: "{}",
      status: "synced",
      attempts: 0,
      queuedAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    await expect(repositories.accounts.getById("account-1")).resolves.toMatchObject({
      id: "account-1",
      userId: "u1",
    });
    await expect(repositories.transactions.listByMonth("u1", "2026-04")).resolves.toHaveLength(1);
    await expect(repositories.monthCloses.getByPeriod("u1", "2026-04")).resolves.toMatchObject({
      id: "close-1",
    });
    await expect(repositories.categories.listDefaults("u1")).resolves.toHaveLength(1);
    await expect(repositories.budgets.listByMonth("u1", "2026-04")).resolves.toHaveLength(1);
    await expect(repositories.syncOutbox.listPendingByUser("u1")).resolves.toHaveLength(1);
  });
});
