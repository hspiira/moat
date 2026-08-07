import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { openFinanceDatabase } from "@/lib/repositories/indexeddb/client";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import type { Item, PlannedPurchase, TransactionLineItem } from "@/lib/types";

const userId = "user-1";
const now = "2026-08-07T00:00:00.000Z";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: `item:${crypto.randomUUID()}`,
    userId,
    name: "Sugar (1kg)",
    normalizedName: "sugar (1kg)",
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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

describe("purchase planner stores", () => {
  beforeEach(async () => {
    setActiveRecordCryptoKey(null);
    await clearIndexedDb();
  });

  it("round-trips an item and finds it by normalized name", async () => {
    const repositories = createIndexedDbRepositories();
    const item = makeItem();
    await repositories.items.upsert(item);

    expect(await repositories.items.findByNormalizedName(userId, "sugar (1kg)")).toEqual(item);
    expect(await repositories.items.findByNormalizedName(userId, "salt")).toBeNull();
  });

  it("lists planned purchases by status", async () => {
    const repositories = createIndexedDbRepositories();
    const base: PlannedPurchase = {
      id: `planned:${crypto.randomUUID()}`,
      userId,
      itemId: "item:a",
      status: "planned",
      createdAt: now,
      updatedAt: now,
    };
    await repositories.plannedPurchases.upsert(base);
    await repositories.plannedPurchases.upsert({
      ...base,
      id: `planned:${crypto.randomUUID()}`,
      status: "purchased",
    });

    const planned = await repositories.plannedPurchases.listByStatus(userId, "planned");
    expect(planned).toHaveLength(1);
    expect(planned[0].id).toBe(base.id);
  });

  it("lists line items by transaction", async () => {
    const repositories = createIndexedDbRepositories();
    const line: TransactionLineItem = {
      id: `line:${crypto.randomUUID()}`,
      userId,
      transactionId: "transaction:t1",
      label: "Sugar",
      createdAt: now,
      updatedAt: now,
    };
    await repositories.transactionLineItems.upsert(line);
    await repositories.transactionLineItems.upsert({
      ...line,
      id: `line:${crypto.randomUUID()}`,
      transactionId: "transaction:t2",
    });

    const forT1 = await repositories.transactionLineItems.listByTransactionId(
      userId,
      "transaction:t1",
    );
    expect(forT1).toHaveLength(1);
    expect(forT1[0].id).toBe(line.id);
  });
});
