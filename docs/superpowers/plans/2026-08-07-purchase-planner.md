# Purchase Planner, Line Items, and Price Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the connected loop from the approved spec ([2026-08-07-purchase-planner-design.md](../specs/2026-08-07-purchase-planner-design.md)): a `/shopping` purchase planner → informal transaction line items → derived per-item price history that surfaces back in the planner.

**Architecture:** Three new stored entities (`Item`, `PlannedPurchase`, `TransactionLineItem`) follow the existing repository/adapter pattern (IndexedDB + SQLite backends behind `StorageAdapter`). All math lives in pure `lib/domain/` modules with unit and property tests. Price observations are derived at read time, never stored. UI follows the workspace-hook + `FeaturePageShell` pattern.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, shadcn/ui, IndexedDB via the existing adapter, vitest + fast-check + fake-indexeddb.

## Global Constraints

- All new UI uses shadcn/ui primitives from `components/ui/` — no native `input`/`select`/`textarea` in user-facing components.
- Never encode meaning in hue alone: cheapest/overdue markers must carry text or an icon.
- Comments only for non-obvious decisions, matching the codebase's commenting voice; no narration comments.
- Commit messages: single sentence, sentence case, no attribution trailers of any kind.
- Amounts are UGX numbers; parse user amount input with `parseAmountInput` from `@/lib/parse-amount`, never `Number()`.
- Entity ids: `` `item:${crypto.randomUUID()}` ``, `` `planned:${crypto.randomUUID()}` ``, `` `line:${crypto.randomUUID()}` `` (matches the `transaction:`/`transfer:` prefix convention).
- Timestamps are ISO strings produced once per operation (`new Date().toISOString()`) and threaded through, matching existing code.
- Verification commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Sync `entityType` for the new entities is the store name (`"items"`, `"plannedPurchases"`, `"transactionLineItems"`), because `enqueueSyncMutation` in `lib/repositories/shared.ts` uses the store name; this deliberately supersedes the snake_case strings in the spec.

---

### Task 1: Data model and storage registration

**Files:**
- Modify: `lib/types.ts` (append after `Category`, around line 213)
- Modify: `lib/repositories/store-names.ts`
- Modify: `lib/repositories/indexeddb/client.ts` (version bump + migration step + indexes)
- Modify: `lib/security/record-crypto.ts` (`metadataFields` map, around line 44)
- Modify: `lib/repositories/types.ts` (new repository interfaces + `RepositoryBundle`)
- Modify: `lib/repositories/shared.ts` (repository factories + bundle assembly)
- Modify: `lib/repositories/instance.ts` (`createBundleProxy`)
- Test: `lib/repositories/purchase-planner-stores.test.ts`

**Interfaces:**
- Consumes: existing `Repository<T>`, `createUserScopedRepository`, `hydrateMany`, `StorageAdapter`.
- Produces (all later tasks depend on these exact shapes):
  - Types `Item`, `PlannedPurchase`, `PlannedPurchaseStatus`, `TransactionLineItem`, `PriceObservation`, `ItemPriceSummary` in `@/lib/types`.
  - `repositories.items: ItemRepository` with `findByNormalizedName(userId: string, normalizedName: string): Promise<Item | null>`.
  - `repositories.plannedPurchases: PlannedPurchaseRepository` with `listByStatus(userId: string, status: PlannedPurchaseStatus): Promise<PlannedPurchase[]>`.
  - `repositories.transactionLineItems: TransactionLineItemRepository` with `listByTransactionId(userId: string, transactionId: string): Promise<TransactionLineItem[]>`.

- [ ] **Step 1: Add the types**

Append to `lib/types.ts` (after the `Category` type):

```ts
export type Item = {
  id: string;
  userId: string;
  name: string;
  normalizedName: string;
  unit?: string;
  defaultCategoryId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlannedPurchaseStatus = "planned" | "purchased" | "dropped";

export type PlannedPurchase = {
  id: string;
  userId: string;
  itemId: string;
  quantity?: number;
  estimatedUnitPrice?: number;
  neededBy?: string;
  note?: string;
  status: PlannedPurchaseStatus;
  linkedTransactionId?: string;
  linkedLineItemId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionLineItem = {
  id: string;
  userId: string;
  transactionId: string;
  itemId?: string;
  label: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  categoryId?: string;
  plannedPurchaseId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Derived, never stored: a line item joined with its transaction's context. */
export type PriceObservation = {
  itemId: string;
  transactionId: string;
  lineItemId: string;
  merchant: string;
  occurredOn: string;
  unitPrice?: number;
  amount?: number;
  quantity?: number;
};

export type ItemPriceSummary = {
  itemId: string;
  lastPaid?: PriceObservation;
  bestRecent?: PriceObservation;
  observationCount: number;
};
```

- [ ] **Step 2: Register the stores**

In `lib/repositories/store-names.ts` add to `storeNames`:

```ts
  items: "items",
  plannedPurchases: "plannedPurchases",
  transactionLineItems: "transactionLineItems",
```

In `lib/repositories/indexeddb/client.ts`:

```ts
const DATABASE_VERSION = 10;
const MIGRATION_VERSIONS = [1, 4, 5, 6, 7, 8, 9, 10] as const;
```

Add to `storeIndexes`:

```ts
  items: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  plannedPurchases: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  transactionLineItems: [{ name: USER_ID_INDEX, keyPath: "userId" }],
```

Add to `migrationSteps`:

```ts
  10: (database) => {
    ensureStore(database, "items");
    ensureStore(database, "plannedPurchases");
    ensureStore(database, "transactionLineItems");
  },
```

In `lib/security/record-crypto.ts` add to `metadataFields`:

```ts
  items: (entity) => ({ userId: String(entity.userId) }),
  plannedPurchases: (entity) => ({ userId: String(entity.userId) }),
  transactionLineItems: (entity) => ({ userId: String(entity.userId) }),
```

Status/transaction filters are applied in JS after `listByUser` (same pattern
as `categories.listDefaults`), so no compound blind indexes are needed.

- [ ] **Step 3: Write the failing repository test**

`lib/repositories/purchase-planner-stores.test.ts`:

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { resetDatabaseForTests } from "@/lib/repositories/indexeddb/client";
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

describe("purchase planner stores", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
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
```

Note: if `resetDatabaseForTests` does not exist in `indexeddb/client.ts`, use
whatever reset helper the existing `lib/repositories/instance.test.ts` and
`adapter-contract.test.ts` use (they run against fake-indexeddb; follow their
setup exactly — including any `resetRepositorySingletonForTests` /
database-deletion helpers).

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test lib/repositories/purchase-planner-stores.test.ts`
Expected: FAIL — `items` does not exist on the bundle / type errors.

- [ ] **Step 5: Add repository interfaces and implementations**

In `lib/repositories/types.ts` (import the new types from `@/lib/types`):

```ts
export interface ItemRepository extends Repository<Item> {
  findByNormalizedName(userId: string, normalizedName: string): Promise<Item | null>;
}

export interface PlannedPurchaseRepository extends Repository<PlannedPurchase> {
  listByStatus(userId: string, status: PlannedPurchaseStatus): Promise<PlannedPurchase[]>;
}

export interface TransactionLineItemRepository extends Repository<TransactionLineItem> {
  listByTransactionId(userId: string, transactionId: string): Promise<TransactionLineItem[]>;
}
```

Add to `RepositoryBundle`:

```ts
  items: ItemRepository;
  plannedPurchases: PlannedPurchaseRepository;
  transactionLineItems: TransactionLineItemRepository;
```

In `lib/repositories/shared.ts` (filters in JS, same rationale as
`listDefaults`):

```ts
function createItemRepository(adapter: StorageAdapter): ItemRepository {
  const repository = createUserScopedRepository<Item>(adapter, "items");
  return {
    ...repository,
    async findByNormalizedName(userId, normalizedName) {
      const items = await repository.listByUser(userId);
      return items.find((item) => item.normalizedName === normalizedName) ?? null;
    },
  };
}

function createPlannedPurchaseRepository(adapter: StorageAdapter): PlannedPurchaseRepository {
  const repository = createUserScopedRepository<PlannedPurchase>(adapter, "plannedPurchases");
  return {
    ...repository,
    async listByStatus(userId, status) {
      const purchases = await repository.listByUser(userId);
      return purchases.filter((purchase) => purchase.status === status);
    },
  };
}

function createTransactionLineItemRepository(
  adapter: StorageAdapter,
): TransactionLineItemRepository {
  const repository = createUserScopedRepository<TransactionLineItem>(
    adapter,
    "transactionLineItems",
  );
  return {
    ...repository,
    async listByTransactionId(userId, transactionId) {
      const lineItems = await repository.listByUser(userId);
      return lineItems.filter((lineItem) => lineItem.transactionId === transactionId);
    },
  };
}
```

Add to `createRepositoryBundle`'s returned object:

```ts
    items: createItemRepository(adapter),
    plannedPurchases: createPlannedPurchaseRepository(adapter),
    transactionLineItems: createTransactionLineItemRepository(adapter),
```

In `lib/repositories/instance.ts` add to `createBundleProxy`:

```ts
    items: lazyRepository("items", ["findByNormalizedName"]),
    plannedPurchases: lazyRepository("plannedPurchases", ["listByStatus"]),
    transactionLineItems: lazyRepository("transactionLineItems", ["listByTransactionId"]),
```

Do NOT add the new stores to `unsyncedStoreNames` — they sync like
transactions do.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test lib/repositories/purchase-planner-stores.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full check**

Run: `pnpm typecheck && pnpm test`
Expected: clean typecheck; full suite passes (the adapter-contract test's
in-memory fake iterates `storeNames`, so new stores ride along automatically).

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/repositories lib/security/record-crypto.ts
git commit -m "Add item, planned purchase, and line item stores"
```

---

### Task 2: Item name normalization and resolution

**Files:**
- Create: `lib/domain/item-normalization.ts`
- Test: `lib/domain/item-normalization.test.ts`

**Interfaces:**
- Produces:
  - `normalizeItemName(raw: string): string`
  - `resolveItem(params: { existing: Item[]; rawName: string; userId: string; timestamp: string }): { item: Item; isNew: boolean }`

- [ ] **Step 1: Write the failing tests**

`lib/domain/item-normalization.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { normalizeItemName, resolveItem } from "@/lib/domain/item-normalization";
import type { Item } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

const sugar: Item = {
  id: "item:sugar",
  userId: "user-1",
  name: "Sugar (1kg)",
  normalizedName: "sugar (1kg)",
  isArchived: false,
  createdAt: now,
  updatedAt: now,
};

describe("normalizeItemName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeItemName("  Sugar   (1kg) ")).toBe("sugar (1kg)");
  });

  it("is idempotent", () => {
    const once = normalizeItemName("  Kakira   SUGAR ");
    expect(normalizeItemName(once)).toBe(once);
  });
});

describe("resolveItem", () => {
  it("reuses an existing item on a normalized match", () => {
    const resolved = resolveItem({
      existing: [sugar],
      rawName: "  SUGAR (1kg)",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(false);
    expect(resolved.item).toBe(sugar);
  });

  it("creates a new item preserving the raw display name", () => {
    const resolved = resolveItem({
      existing: [sugar],
      rawName: " Cooking Oil ",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(true);
    expect(resolved.item.name).toBe("Cooking Oil");
    expect(resolved.item.normalizedName).toBe("cooking oil");
    expect(resolved.item.id.startsWith("item:")).toBe(true);
    expect(resolved.item.isArchived).toBe(false);
  });

  it("does not match archived items", () => {
    const archived = { ...sugar, isArchived: true };
    const resolved = resolveItem({
      existing: [archived],
      rawName: "sugar (1kg)",
      userId: "user-1",
      timestamp: now,
    });
    expect(resolved.isNew).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/domain/item-normalization.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/domain/item-normalization.ts`:

```ts
import type { Item } from "@/lib/types";

export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Exact normalized match reuses the item; anything else creates one. Archived
 * items never match so a re-used name starts a fresh history on purpose.
 */
export function resolveItem(params: {
  existing: Item[];
  rawName: string;
  userId: string;
  timestamp: string;
}): { item: Item; isNew: boolean } {
  const normalizedName = normalizeItemName(params.rawName);
  const match = params.existing.find(
    (item) => !item.isArchived && item.normalizedName === normalizedName,
  );
  if (match) {
    return { item: match, isNew: false };
  }
  return {
    isNew: true,
    item: {
      id: `item:${crypto.randomUUID()}`,
      userId: params.userId,
      name: params.rawName.trim().replace(/\s+/g, " "),
      normalizedName,
      isArchived: false,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/domain/item-normalization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/item-normalization.ts lib/domain/item-normalization.test.ts
git commit -m "Resolve item identity from normalized names"
```

---

### Task 3: Itemization summary math

**Files:**
- Create: `lib/domain/line-items.ts`
- Test: `lib/domain/line-items.test.ts`

**Interfaces:**
- Produces:
  - `lineItemAmount(line: Pick<TransactionLineItem, "amount" | "quantity" | "unitPrice">): number | undefined`
  - `type ItemizationSummary = { itemizedTotal: number; unitemized: number; overItemizedBy: number }`
  - `summarizeItemization(transactionAmount: number, lineItems: TransactionLineItem[]): ItemizationSummary`

- [ ] **Step 1: Write the failing tests (including the property test)**

`lib/domain/line-items.test.ts`:

```ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lineItemAmount, summarizeItemization } from "@/lib/domain/line-items";
import type { TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

function line(overrides: Partial<TransactionLineItem>): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: "user-1",
    transactionId: "transaction:t1",
    label: "Sugar",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("lineItemAmount", () => {
  it("prefers the explicit amount", () => {
    expect(lineItemAmount({ amount: 3500, quantity: 2, unitPrice: 2000 })).toBe(3500);
  });

  it("derives quantity times unit price when amount is absent", () => {
    expect(lineItemAmount({ quantity: 2, unitPrice: 1750 })).toBe(3500);
  });

  it("is undefined when neither is computable", () => {
    expect(lineItemAmount({ quantity: 2 })).toBeUndefined();
    expect(lineItemAmount({})).toBeUndefined();
  });
});

describe("summarizeItemization", () => {
  it("reports partial itemization with a remainder", () => {
    const summary = summarizeItemization(60000, [
      line({ amount: 41500 }),
      line({ label: "Salt" }),
    ]);
    expect(summary).toEqual({ itemizedTotal: 41500, unitemized: 18500, overItemizedBy: 0 });
  });

  it("reports over-itemization instead of clamping", () => {
    const summary = summarizeItemization(1000, [line({ amount: 1500 })]);
    expect(summary).toEqual({ itemizedTotal: 1500, unitemized: 0, overItemizedBy: 500 });
  });

  it("never produces negative components", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000_000 }),
        fc.array(fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }), { maxLength: 20 }),
        (transactionAmount, amounts) => {
          const summary = summarizeItemization(
            transactionAmount,
            amounts.map((amount) => line({ amount })),
          );
          expect(summary.itemizedTotal).toBeGreaterThanOrEqual(0);
          expect(summary.unitemized).toBeGreaterThanOrEqual(0);
          expect(summary.overItemizedBy).toBeGreaterThanOrEqual(0);
          // Exactly one of unitemized / overItemizedBy is nonzero, and they
          // reconcile against the transaction amount.
          expect(summary.itemizedTotal - summary.overItemizedBy + summary.unitemized).toBe(
            transactionAmount,
          );
        },
      ),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/domain/line-items.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/domain/line-items.ts`:

```ts
import type { TransactionLineItem } from "@/lib/types";

export function lineItemAmount(
  line: Pick<TransactionLineItem, "amount" | "quantity" | "unitPrice">,
): number | undefined {
  if (line.amount != null) {
    return line.amount;
  }
  if (line.quantity != null && line.unitPrice != null) {
    return line.quantity * line.unitPrice;
  }
  return undefined;
}

export type ItemizationSummary = {
  itemizedTotal: number;
  unitemized: number;
  overItemizedBy: number;
};

/**
 * Itemization is informal: lines may cover part, all, or (by mistake) more
 * than the transaction amount. Over-coverage is reported, never clamped, so
 * the UI can say "over-itemized by X" instead of silently lying.
 */
export function summarizeItemization(
  transactionAmount: number,
  lineItems: TransactionLineItem[],
): ItemizationSummary {
  const itemizedTotal = lineItems.reduce(
    (total, line) => total + (lineItemAmount(line) ?? 0),
    0,
  );
  return {
    itemizedTotal,
    unitemized: Math.max(0, transactionAmount - itemizedTotal),
    overItemizedBy: Math.max(0, itemizedTotal - transactionAmount),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/domain/line-items.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/line-items.ts lib/domain/line-items.test.ts
git commit -m "Add informal itemization math"
```

---

### Task 4: Derived price observations and per-item summaries

**Files:**
- Create: `lib/domain/price-observations.ts`
- Test: `lib/domain/price-observations.test.ts`

**Interfaces:**
- Consumes: `lineItemAmount` from Task 3.
- Produces:
  - `derivePriceObservations(lineItems: TransactionLineItem[], transactions: Transaction[]): PriceObservation[]`
  - `summarizeItemPrices(observations: PriceObservation[], today: string): Map<string, ItemPriceSummary>`

- [ ] **Step 1: Write the failing tests**

`lib/domain/price-observations.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  derivePriceObservations,
  summarizeItemPrices,
} from "@/lib/domain/price-observations";
import type { PriceObservation, Transaction, TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "transaction:t1",
    userId: "user-1",
    accountId: "account-1",
    type: "expense",
    amount: 60000,
    currency: "UGX",
    originalAmount: 60000,
    occurredOn: "2026-08-01",
    categoryId: "category-food",
    reconciliationState: "posted",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function line(overrides: Partial<TransactionLineItem>): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: "user-1",
    transactionId: "transaction:t1",
    itemId: "item:sugar",
    label: "Sugar",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("derivePriceObservations", () => {
  it("joins line items with their transaction and skips itemless lines", () => {
    const transactions = [transaction({ payee: "Mega Standard" })];
    const lines = [
      line({ unitPrice: 3500, quantity: 1 }),
      line({ itemId: undefined, label: "misc" }),
    ];
    const observations = derivePriceObservations(lines, transactions);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      itemId: "item:sugar",
      merchant: "Mega Standard",
      occurredOn: "2026-08-01",
      unitPrice: 3500,
    });
  });

  it("skips lines whose transaction is missing and defaults merchant", () => {
    const observations = derivePriceObservations(
      [line({}), line({ transactionId: "transaction:gone" })],
      [transaction({ payee: undefined })],
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].merchant).toBe("Unknown");
  });
});

describe("summarizeItemPrices", () => {
  const base: PriceObservation = {
    itemId: "item:sugar",
    transactionId: "transaction:t1",
    lineItemId: "line:1",
    merchant: "Mega Standard",
    occurredOn: "2026-08-01",
    unitPrice: 3500,
  };

  it("picks the latest as lastPaid and the cheapest recent as bestRecent", () => {
    const observations: PriceObservation[] = [
      base,
      { ...base, lineItemId: "line:2", occurredOn: "2026-06-10", merchant: "Owino", unitPrice: 2800 },
      { ...base, lineItemId: "line:3", occurredOn: "2024-01-01", merchant: "Old", unitPrice: 100 },
    ];
    const summary = summarizeItemPrices(observations, "2026-08-07").get("item:sugar");
    expect(summary?.lastPaid?.merchant).toBe("Mega Standard");
    expect(summary?.bestRecent?.merchant).toBe("Owino");
    expect(summary?.observationCount).toBe(3);
  });

  it("falls back to amount when no unit prices exist in the window", () => {
    const observations: PriceObservation[] = [
      { ...base, unitPrice: undefined, amount: 12000 },
      { ...base, lineItemId: "line:2", occurredOn: "2026-07-01", unitPrice: undefined, amount: 9000, merchant: "Kalerwe" },
    ];
    const summary = summarizeItemPrices(observations, "2026-08-07").get("item:sugar");
    expect(summary?.bestRecent?.merchant).toBe("Kalerwe");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/domain/price-observations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/domain/price-observations.ts`:

```ts
import type {
  ItemPriceSummary,
  PriceObservation,
  Transaction,
  TransactionLineItem,
} from "@/lib/types";

export function derivePriceObservations(
  lineItems: TransactionLineItem[],
  transactions: Transaction[],
): PriceObservation[] {
  const transactionsById = new Map(transactions.map((entry) => [entry.id, entry]));
  const observations: PriceObservation[] = [];
  for (const line of lineItems) {
    if (!line.itemId) continue;
    const transaction = transactionsById.get(line.transactionId);
    if (!transaction) continue;
    observations.push({
      itemId: line.itemId,
      transactionId: transaction.id,
      lineItemId: line.id,
      merchant: transaction.payee ?? "Unknown",
      occurredOn: transaction.occurredOn,
      unitPrice: line.unitPrice,
      amount: line.amount,
      quantity: line.quantity,
    });
  }
  return observations;
}

/** ISO date 12 months before `today`, for the bestRecent window. */
function recentCutoff(today: string): string {
  const [year, rest] = [Number(today.slice(0, 4)) - 1, today.slice(4)];
  return `${year}${rest}`;
}

function pricePoint(observation: PriceObservation): number | undefined {
  return observation.unitPrice ?? observation.amount;
}

export function summarizeItemPrices(
  observations: PriceObservation[],
  today: string,
): Map<string, ItemPriceSummary> {
  const cutoff = recentCutoff(today);
  const summaries = new Map<string, ItemPriceSummary>();
  for (const observation of observations) {
    const summary = summaries.get(observation.itemId) ?? {
      itemId: observation.itemId,
      observationCount: 0,
    };
    summary.observationCount += 1;
    if (!summary.lastPaid || observation.occurredOn > summary.lastPaid.occurredOn) {
      summary.lastPaid = observation;
    }
    const price = pricePoint(observation);
    if (price != null && observation.occurredOn >= cutoff) {
      const bestPrice = summary.bestRecent ? pricePoint(summary.bestRecent) : undefined;
      if (bestPrice == null || price < bestPrice) {
        summary.bestRecent = observation;
      }
    }
    summaries.set(observation.itemId, summary);
  }
  return summaries;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/domain/price-observations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/price-observations.ts lib/domain/price-observations.test.ts
git commit -m "Derive per-item price observations and summaries"
```

---

### Task 5: Planned purchase math, fulfillment, and reversal

**Files:**
- Create: `lib/domain/planned-purchases.ts`
- Test: `lib/domain/planned-purchases.test.ts`

**Interfaces:**
- Produces:
  - `estimatePlannedTotal(purchases: PlannedPurchase[]): { total: number; unestimatedCount: number }`
  - `type PlannerGroups = { overdue: PlannedPurchase[]; upcoming: PlannedPurchase[]; someday: PlannedPurchase[]; history: PlannedPurchase[] }`
  - `groupPlannerRows(purchases: PlannedPurchase[], today: string): PlannerGroups`
  - `buildFulfillmentLineItem(purchase: PlannedPurchase, item: Item, transactionId: string, timestamp: string): TransactionLineItem`
  - `fulfillPurchase(purchase: PlannedPurchase, lineItem: TransactionLineItem, timestamp: string): PlannedPurchase`
  - `revertPurchase(purchase: PlannedPurchase, timestamp: string): PlannedPurchase`

- [ ] **Step 1: Write the failing tests (including the round-trip property)**

`lib/domain/planned-purchases.test.ts`:

```ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildFulfillmentLineItem,
  estimatePlannedTotal,
  fulfillPurchase,
  groupPlannerRows,
  revertPurchase,
} from "@/lib/domain/planned-purchases";
import type { Item, PlannedPurchase } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

function purchase(overrides: Partial<PlannedPurchase> = {}): PlannedPurchase {
  return {
    id: `planned:${crypto.randomUUID()}`,
    userId: "user-1",
    itemId: "item:sugar",
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const sugar: Item = {
  id: "item:sugar",
  userId: "user-1",
  name: "Sugar (1kg)",
  normalizedName: "sugar (1kg)",
  isArchived: false,
  createdAt: now,
  updatedAt: now,
};

describe("estimatePlannedTotal", () => {
  it("sums (quantity ?? 1) × estimatedUnitPrice and counts unestimated rows", () => {
    const result = estimatePlannedTotal([
      purchase({ estimatedUnitPrice: 3500, quantity: 2 }),
      purchase({ estimatedUnitPrice: 4000 }),
      purchase({}),
      purchase({ status: "purchased", estimatedUnitPrice: 99999 }),
    ]);
    expect(result).toEqual({ total: 11000, unestimatedCount: 1 });
  });
});

describe("groupPlannerRows", () => {
  it("splits by neededBy relative to today, history last", () => {
    const overdue = purchase({ neededBy: "2026-08-01" });
    const upcoming = purchase({ neededBy: "2026-08-20" });
    const someday = purchase({});
    const done = purchase({ status: "purchased" });
    const dropped = purchase({ status: "dropped" });

    const groups = groupPlannerRows([overdue, upcoming, someday, done, dropped], "2026-08-07");
    expect(groups.overdue).toEqual([overdue]);
    expect(groups.upcoming).toEqual([upcoming]);
    expect(groups.someday).toEqual([someday]);
    expect(groups.history).toEqual([done, dropped]);
  });

  it("counts today as upcoming, not overdue", () => {
    const dueToday = purchase({ neededBy: "2026-08-07" });
    const groups = groupPlannerRows([dueToday], "2026-08-07");
    expect(groups.upcoming).toEqual([dueToday]);
  });
});

describe("fulfillment", () => {
  it("builds a line item carrying the plan's estimates and back-link", () => {
    const planned = purchase({ quantity: 2, estimatedUnitPrice: 3500 });
    const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now);
    expect(lineItem).toMatchObject({
      transactionId: "transaction:t1",
      itemId: "item:sugar",
      label: "Sugar (1kg)",
      quantity: 2,
      unitPrice: 3500,
      plannedPurchaseId: planned.id,
    });
    expect(lineItem.id.startsWith("line:")).toBe(true);
  });

  it("fulfill then revert round-trips the purchase state", () => {
    fc.assert(
      fc.property(
        fc.option(fc.nat({ max: 100 }), { nil: undefined }),
        fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }),
        (quantity, estimatedUnitPrice) => {
          const planned = purchase({ quantity, estimatedUnitPrice });
          const lineItem = buildFulfillmentLineItem(planned, sugar, "transaction:t1", now);
          const fulfilled = fulfillPurchase(planned, lineItem, now);
          expect(fulfilled.status).toBe("purchased");
          expect(fulfilled.linkedTransactionId).toBe("transaction:t1");
          expect(fulfilled.linkedLineItemId).toBe(lineItem.id);

          const reverted = revertPurchase(fulfilled, "2026-08-08T00:00:00.000Z");
          expect(reverted).toEqual({
            ...planned,
            updatedAt: "2026-08-08T00:00:00.000Z",
          });
        },
      ),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/domain/planned-purchases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/domain/planned-purchases.ts`:

```ts
import type { Item, PlannedPurchase, TransactionLineItem } from "@/lib/types";

export function estimatePlannedTotal(purchases: PlannedPurchase[]): {
  total: number;
  unestimatedCount: number;
} {
  let total = 0;
  let unestimatedCount = 0;
  for (const purchase of purchases) {
    if (purchase.status !== "planned") continue;
    if (purchase.estimatedUnitPrice == null) {
      unestimatedCount += 1;
      continue;
    }
    total += (purchase.quantity ?? 1) * purchase.estimatedUnitPrice;
  }
  return { total, unestimatedCount };
}

export type PlannerGroups = {
  overdue: PlannedPurchase[];
  upcoming: PlannedPurchase[];
  someday: PlannedPurchase[];
  history: PlannedPurchase[];
};

export function groupPlannerRows(purchases: PlannedPurchase[], today: string): PlannerGroups {
  const groups: PlannerGroups = { overdue: [], upcoming: [], someday: [], history: [] };
  for (const purchase of purchases) {
    if (purchase.status !== "planned") {
      groups.history.push(purchase);
    } else if (!purchase.neededBy) {
      groups.someday.push(purchase);
    } else if (purchase.neededBy < today) {
      groups.overdue.push(purchase);
    } else {
      groups.upcoming.push(purchase);
    }
  }
  return groups;
}

export function buildFulfillmentLineItem(
  purchase: PlannedPurchase,
  item: Item,
  transactionId: string,
  timestamp: string,
): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: purchase.userId,
    transactionId,
    itemId: purchase.itemId,
    label: item.name,
    quantity: purchase.quantity,
    unitPrice: purchase.estimatedUnitPrice,
    plannedPurchaseId: purchase.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function fulfillPurchase(
  purchase: PlannedPurchase,
  lineItem: TransactionLineItem,
  timestamp: string,
): PlannedPurchase {
  return {
    ...purchase,
    status: "purchased",
    linkedTransactionId: lineItem.transactionId,
    linkedLineItemId: lineItem.id,
    updatedAt: timestamp,
  };
}

export function revertPurchase(purchase: PlannedPurchase, timestamp: string): PlannedPurchase {
  return {
    ...purchase,
    status: "planned",
    linkedTransactionId: undefined,
    linkedLineItemId: undefined,
    updatedAt: timestamp,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/domain/planned-purchases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/planned-purchases.ts lib/domain/planned-purchases.test.ts
git commit -m "Add planned purchase math and fulfillment transitions"
```

---

### Task 6: Delete cascades

**Files:**
- Create: `lib/domain/line-item-cascade.ts`
- Test: `lib/domain/line-item-cascade.test.ts`
- Modify: `components/transactions/use-transactions-workspace.ts` (`handleDeleteTransaction`, around line 690)

**Interfaces:**
- Consumes: `revertPurchase` from Task 5; repositories from Task 1.
- Produces:
  - `planLineItemCascade(params: { deletedTransactionIds: ReadonlySet<string>; lineItems: TransactionLineItem[]; plannedPurchases: PlannedPurchase[]; timestamp: string }): { lineItemIdsToDelete: string[]; purchasesToRevert: PlannedPurchase[] }`

- [ ] **Step 1: Write the failing tests**

`lib/domain/line-item-cascade.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { planLineItemCascade } from "@/lib/domain/line-item-cascade";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

const lineOnT1: TransactionLineItem = {
  id: "line:1",
  userId: "user-1",
  transactionId: "transaction:t1",
  label: "Sugar",
  plannedPurchaseId: "planned:1",
  createdAt: now,
  updatedAt: now,
};

const lineOnT2: TransactionLineItem = { ...lineOnT1, id: "line:2", transactionId: "transaction:t2", plannedPurchaseId: undefined };

const purchase: PlannedPurchase = {
  id: "planned:1",
  userId: "user-1",
  itemId: "item:sugar",
  status: "purchased",
  linkedTransactionId: "transaction:t1",
  linkedLineItemId: "line:1",
  createdAt: now,
  updatedAt: now,
};

describe("planLineItemCascade", () => {
  it("deletes lines of deleted transactions and reverts their purchases", () => {
    const plan = planLineItemCascade({
      deletedTransactionIds: new Set(["transaction:t1"]),
      lineItems: [lineOnT1, lineOnT2],
      plannedPurchases: [purchase],
      timestamp: "2026-08-08T00:00:00.000Z",
    });
    expect(plan.lineItemIdsToDelete).toEqual(["line:1"]);
    expect(plan.purchasesToRevert).toHaveLength(1);
    expect(plan.purchasesToRevert[0]).toMatchObject({
      id: "planned:1",
      status: "planned",
      linkedTransactionId: undefined,
      linkedLineItemId: undefined,
      updatedAt: "2026-08-08T00:00:00.000Z",
    });
  });

  it("is a no-op when nothing matches", () => {
    const plan = planLineItemCascade({
      deletedTransactionIds: new Set(["transaction:none"]),
      lineItems: [lineOnT1],
      plannedPurchases: [purchase],
      timestamp: now,
    });
    expect(plan.lineItemIdsToDelete).toEqual([]);
    expect(plan.purchasesToRevert).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/domain/line-item-cascade.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/domain/line-item-cascade.ts`:

```ts
import { revertPurchase } from "@/lib/domain/planned-purchases";
import type { PlannedPurchase, TransactionLineItem } from "@/lib/types";

/**
 * Everything a transaction delete must take with it: its line items, and the
 * reversal of any planned purchases those line items had fulfilled. Pure so
 * the workspace hook only executes the plan.
 */
export function planLineItemCascade(params: {
  deletedTransactionIds: ReadonlySet<string>;
  lineItems: TransactionLineItem[];
  plannedPurchases: PlannedPurchase[];
  timestamp: string;
}): { lineItemIdsToDelete: string[]; purchasesToRevert: PlannedPurchase[] } {
  const doomedLines = params.lineItems.filter((line) =>
    params.deletedTransactionIds.has(line.transactionId),
  );
  const doomedLineIds = new Set(doomedLines.map((line) => line.id));
  const purchasesToRevert = params.plannedPurchases
    .filter(
      (purchase) =>
        purchase.linkedLineItemId != null && doomedLineIds.has(purchase.linkedLineItemId),
    )
    .map((purchase) => revertPurchase(purchase, params.timestamp));
  return {
    lineItemIdsToDelete: [...doomedLineIds],
    purchasesToRevert,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/domain/line-item-cascade.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the cascade into transaction deletion**

In `components/transactions/use-transactions-workspace.ts`, inside
`handleDeleteTransaction`, after the existing `idsToRemove` set is complete
(fee cascade included) and before/alongside the `Promise.all` that removes
transactions, add:

```ts
        const [lineItems, plannedPurchases] = await Promise.all([
          repositories.transactionLineItems.listByUser(profile.id),
          repositories.plannedPurchases.listByUser(profile.id),
        ]);
        const cascade = planLineItemCascade({
          deletedTransactionIds: idsToRemove,
          lineItems,
          plannedPurchases,
          timestamp: new Date().toISOString(),
        });
        await Promise.all([
          ...[...idsToRemove].map((id) => repositories.transactions.remove(id)),
          ...cascade.lineItemIdsToDelete.map((id) =>
            repositories.transactionLineItems.remove(id),
          ),
          ...cascade.purchasesToRevert.map((purchase) =>
            repositories.plannedPurchases.upsert(purchase),
          ),
        ]);
```

(This replaces the existing `await Promise.all([...idsToRemove].map(...))`
line.) Import `planLineItemCascade` from `@/lib/domain/line-item-cascade`.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/line-item-cascade.ts lib/domain/line-item-cascade.test.ts components/transactions/use-transactions-workspace.ts
git commit -m "Cascade line items and planned purchases through transaction deletes"
```

---

### Task 7: Items section on the transaction detail sheet

**Files:**
- Create: `components/transactions/line-items-section.tsx`
- Modify: `components/transactions/transaction-detail-sheet.tsx`
- Modify: `components/transactions/use-transactions-workspace.ts` (load + mutate line items)
- Modify: `components/transactions-ledger-workspace.tsx` (pass new props, around line 134)
- Modify: `components/transactions-review-workspace.tsx` (pass new props)

**Interfaces:**
- Consumes: `summarizeItemization`, `lineItemAmount` (Task 3), `resolveItem` (Task 2), `revertPurchase` (Task 5), repositories (Task 1).
- Produces (workspace hook additions used here and referenced nowhere else):
  - `workspace.lineItems: TransactionLineItem[]` (all of the user's line items, loaded in `loadWorkspace`)
  - `workspace.saveLineItem(input: { id?: string; transactionId: string; label: string; quantity?: number; unitPrice?: number; amount?: number; categoryId?: string }): Promise<void>`
  - `workspace.deleteLineItem(lineItem: TransactionLineItem): Promise<void>`

- [ ] **Step 1: Extend the workspace hook**

In `use-transactions-workspace.ts`:

1. Add state `const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);` and load it in `loadWorkspace` alongside the other `repositories.*.listByUser(profile.id)` calls (`repositories.transactionLineItems.listByUser(...)` → `setLineItems`), following exactly how `transactions`/`categories` are loaded there.
2. Add the two mutations:

```ts
  const saveLineItem = useCallback(
    async (input: {
      id?: string;
      transactionId: string;
      label: string;
      quantity?: number;
      unitPrice?: number;
      amount?: number;
      categoryId?: string;
    }) => {
      if (!profile) return;
      const timestamp = new Date().toISOString();
      const existingItems = await repositories.items.listByUser(profile.id);
      const resolved = resolveItem({
        existing: existingItems,
        rawName: input.label,
        userId: profile.id,
        timestamp,
      });
      if (resolved.isNew) {
        await repositories.items.upsert(resolved.item);
      }
      const existing = input.id
        ? lineItems.find((line) => line.id === input.id)
        : undefined;
      await repositories.transactionLineItems.upsert({
        id: input.id ?? `line:${crypto.randomUUID()}`,
        userId: profile.id,
        transactionId: input.transactionId,
        itemId: resolved.item.id,
        label: input.label.trim(),
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        amount: input.amount,
        categoryId: input.categoryId,
        plannedPurchaseId: existing?.plannedPurchaseId,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      await loadWorkspace();
    },
    [lineItems, loadWorkspace, profile],
  );

  const deleteLineItem = useCallback(
    async (lineItem: TransactionLineItem) => {
      if (!profile) return;
      const timestamp = new Date().toISOString();
      await repositories.transactionLineItems.remove(lineItem.id);
      if (lineItem.plannedPurchaseId) {
        const purchase = await repositories.plannedPurchases.getById(
          lineItem.plannedPurchaseId,
        );
        if (purchase) {
          await repositories.plannedPurchases.upsert(revertPurchase(purchase, timestamp));
        }
      }
      await loadWorkspace();
    },
    [loadWorkspace, profile],
  );
```

3. Export `lineItems`, `saveLineItem`, `deleteLineItem` from the hook's
   returned object. Import `resolveItem` from
   `@/lib/domain/item-normalization` and `revertPurchase` from
   `@/lib/domain/planned-purchases`.

- [ ] **Step 2: Build the section component**

`components/transactions/line-items-section.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { lineItemAmount, summarizeItemization } from "@/lib/domain/line-items";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Transaction, TransactionLineItem } from "@/lib/types";

import { DetailSection } from "./detail-row";

const emptyDraft = { label: "", quantity: "", unitPrice: "", amount: "" };

/**
 * Informal itemization of one expense: lines may cover part or all of the
 * amount, and the summary line reports the gap instead of blocking entry.
 */
export function LineItemsSection({
  transaction,
  lineItems,
  isSubmitting,
  onSave,
  onDelete,
}: {
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  isSubmitting: boolean;
  onSave: (input: {
    id?: string;
    transactionId: string;
    label: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }) => void;
  onDelete: (lineItem: TransactionLineItem) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const summary = summarizeItemization(transaction.amount, lineItems);

  const submitDraft = () => {
    if (!draft.label.trim()) return;
    onSave({
      transactionId: transaction.id,
      label: draft.label,
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      unitPrice: parseAmountInput(draft.unitPrice) ?? undefined,
      amount: parseAmountInput(draft.amount) ?? undefined,
    });
    setDraft(emptyDraft);
  };

  return (
    <DetailSection title="Items">
      {lineItems.length > 0 ? (
        <ul className="grid gap-2">
          {lineItems.map((line) => {
            const amount = lineItemAmount(line);
            return (
              <li key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {line.label}
                  {line.quantity != null ? (
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {amount != null ? (
                    <Money amount={amount} tone="neutral" />
                  ) : (
                    <span className="text-xs text-muted-foreground">no amount</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() => onDelete(line)}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No items recorded for this transaction yet.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {summary.overItemizedBy > 0
          ? `Items exceed the transaction by ${summary.overItemizedBy.toLocaleString()} UGX.`
          : `Itemized ${summary.itemizedTotal.toLocaleString()} of ${transaction.amount.toLocaleString()} UGX — ${summary.unitemized.toLocaleString()} unitemized.`}
      </p>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor="line-item-label">Item</Label>
          <Input
            id="line-item-label"
            value={draft.label}
            placeholder="Sugar (1kg)"
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-quantity">Qty</Label>
          <Input
            id="line-item-quantity"
            inputMode="numeric"
            value={draft.quantity}
            onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-unit-price">Unit price</Label>
          <Input
            id="line-item-unit-price"
            inputMode="numeric"
            value={draft.unitPrice}
            onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-amount">Amount</Label>
          <Input
            id="line-item-amount"
            inputMode="numeric"
            value={draft.amount}
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
          />
        </div>
        <Button
          size="sm"
          disabled={isSubmitting || !draft.label.trim()}
          onClick={submitDraft}
        >
          Add item
        </Button>
      </div>
    </DetailSection>
  );
}
```

Check `detail-row.tsx` for `DetailSection`'s actual props (title/children) and
match them; if it renders differently, adapt the wrapper, not the content.

- [ ] **Step 3: Wire into the detail sheet and both workspaces**

`transaction-detail-sheet.tsx` — add optional props and render the section for
non-transfer subjects:

```tsx
  lineItems,
  isSubmitting,
  onSaveLineItem,
  onDeleteLineItem,
```

typed as:

```tsx
  lineItems?: TransactionLineItem[];
  isSubmitting?: boolean;
  onSaveLineItem?: (input: {
    id?: string;
    transactionId: string;
    label: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }) => void;
  onDeleteLineItem?: (lineItem: TransactionLineItem) => void;
```

Render after the existing detail sections, only when handlers are provided and
the subject is an expense:

```tsx
      {subject && subject.type === "expense" && onSaveLineItem && onDeleteLineItem ? (
        <LineItemsSection
          transaction={subject}
          lineItems={(lineItems ?? []).filter((line) => line.transactionId === subject.id)}
          isSubmitting={isSubmitting ?? false}
          onSave={onSaveLineItem}
          onDelete={onDeleteLineItem}
        />
      ) : null}
```

In `transactions-ledger-workspace.tsx` pass:

```tsx
        lineItems={workspace.lineItems}
        isSubmitting={workspace.isSubmitting}
        onSaveLineItem={(input) => void workspace.saveLineItem(input)}
        onDeleteLineItem={(lineItem) => void workspace.deleteLineItem(lineItem)}
```

In `transactions-review-workspace.tsx` pass the same four props from its
workspace hook instance.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. Then `pnpm dev`, open a transaction's detail sheet from
`/transactions/ledger`, add an item with only a label (no amount), an item
with quantity × unit price, and confirm the summary line reads correctly and
delete works.

- [ ] **Step 5: Commit**

```bash
git add components/transactions
git commit -m "Let a transaction say what was actually in the bag"
```

---

### Task 8: Shopping planner route, nav, and workspace

**Files:**
- Create: `app/shopping/page.tsx`
- Create: `components/shopping-workspace.tsx`
- Create: `components/shopping/use-shopping-workspace.ts`
- Create: `components/shopping/planner-add-form.tsx`
- Create: `components/shopping/planner-list.tsx`
- Modify: `lib/data.ts` (nav entry)

**Interfaces:**
- Consumes: Tasks 1–5 domain functions and repositories; `FeaturePageShell` (see `components/budgets-workspace.tsx` for exact usage); `useToast`-style feedback if present in other hooks (mirror `use-transactions-workspace`'s `show`).
- Produces (used by Task 9 and 10):
  - `useShoppingWorkspace()` returning `{ profile, isLoading, error, items, purchases, groups, estimate, priceSummaries, addPurchase, dropPurchase, refresh, recentExpenses, checkOff }` — exact shapes below.

- [ ] **Step 1: Add the nav entry and route**

In `lib/data.ts`, insert into `navItems` after the Transactions entry:

```ts
  {
    href: "/shopping",
    label: "Shopping",
    description: "Plan what to buy and remember what it cost last time.",
  },
```

`app/shopping/page.tsx` (mirrors `app/budgets/page.tsx`):

```tsx
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { ShoppingWorkspace } from "@/components/shopping-workspace";

export default function ShoppingPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ShoppingWorkspace />
      </Suspense>
    </AppShell>
  );
}
```

- [ ] **Step 2: Build the workspace hook**

`components/shopping/use-shopping-workspace.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveItem } from "@/lib/domain/item-normalization";
import {
  buildFulfillmentLineItem,
  estimatePlannedTotal,
  fulfillPurchase,
  groupPlannerRows,
} from "@/lib/domain/planned-purchases";
import {
  derivePriceObservations,
  summarizeItemPrices,
} from "@/lib/domain/price-observations";
import { repositories } from "@/lib/repositories/instance";
import type {
  Item,
  ItemPriceSummary,
  PlannedPurchase,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";

export type CheckOffTarget =
  | { mode: "attach"; transactionId: string }
  | {
      mode: "create";
      accountId: string;
      categoryId: string;
      payee: string;
      occurredOn: string;
      amount: number;
    };

export function useShoppingWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<PlannedPurchase[]>([]);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const loadedProfile = await repositories.userProfile.get();
      setProfile(loadedProfile);
      if (!loadedProfile) return;
      const [loadedItems, loadedPurchases, loadedLines, loadedTransactions] =
        await Promise.all([
          repositories.items.listByUser(loadedProfile.id),
          repositories.plannedPurchases.listByUser(loadedProfile.id),
          repositories.transactionLineItems.listByUser(loadedProfile.id),
          repositories.transactions.listByUser(loadedProfile.id),
        ]);
      setItems(loadedItems);
      setPurchases(loadedPurchases);
      setLineItems(loadedLines);
      setTransactions(loadedTransactions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load shopping.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = new Date().toISOString().slice(0, 10);
  const groups = useMemo(() => groupPlannerRows(purchases, today), [purchases, today]);
  const estimate = useMemo(() => estimatePlannedTotal(purchases), [purchases]);
  const priceSummaries: Map<string, ItemPriceSummary> = useMemo(
    () => summarizeItemPrices(derivePriceObservations(lineItems, transactions), today),
    [lineItems, transactions, today],
  );
  const recentExpenses = useMemo(
    () =>
      transactions
        .filter((entry) => entry.type === "expense")
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
        .slice(0, 15),
    [transactions],
  );

  const addPurchase = useCallback(
    async (input: {
      name: string;
      quantity?: number;
      estimatedUnitPrice?: number;
      neededBy?: string;
      note?: string;
    }) => {
      if (!profile) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        const resolved = resolveItem({
          existing: items,
          rawName: input.name,
          userId: profile.id,
          timestamp,
        });
        if (resolved.isNew) {
          await repositories.items.upsert(resolved.item);
        }
        await repositories.plannedPurchases.upsert({
          id: `planned:${crypto.randomUUID()}`,
          userId: profile.id,
          itemId: resolved.item.id,
          quantity: input.quantity,
          estimatedUnitPrice: input.estimatedUnitPrice,
          neededBy: input.neededBy,
          note: input.note,
          status: "planned",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't add the item.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [items, profile, refresh],
  );

  const dropPurchase = useCallback(
    async (purchase: PlannedPurchase) => {
      await repositories.plannedPurchases.upsert({
        ...purchase,
        status: "dropped",
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    },
    [refresh],
  );

  const checkOff = useCallback(
    async (selected: PlannedPurchase[], target: CheckOffTarget) => {
      if (!profile || selected.length === 0) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        let transactionId: string;
        if (target.mode === "attach") {
          transactionId = target.transactionId;
        } else {
          transactionId = `transaction:${crypto.randomUUID()}`;
          await repositories.transactions.upsert({
            id: transactionId,
            userId: profile.id,
            accountId: target.accountId,
            type: "expense",
            amount: target.amount,
            currency: "UGX",
            originalAmount: target.amount,
            occurredOn: target.occurredOn,
            categoryId: target.categoryId,
            reconciliationState: "posted",
            source: "manual",
            payee: target.payee.trim() || undefined,
            reviewedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
        const itemsById = new Map(items.map((item) => [item.id, item]));
        for (const purchase of selected) {
          const item = itemsById.get(purchase.itemId);
          if (!item) continue;
          const lineItem = buildFulfillmentLineItem(purchase, item, transactionId, timestamp);
          await repositories.transactionLineItems.upsert(lineItem);
          await repositories.plannedPurchases.upsert(
            fulfillPurchase(purchase, lineItem, timestamp),
          );
        }
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't record the purchase.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [items, profile, refresh],
  );

  return {
    profile,
    isLoading,
    error,
    isSubmitting,
    items,
    purchases,
    groups,
    estimate,
    priceSummaries,
    recentExpenses,
    addPurchase,
    dropPurchase,
    checkOff,
    refresh,
  };
}
```

Note: the create path writes the transaction directly (not through
`buildManualTransaction`) because there is no `TransactionFormState` here;
`reconciliationState: "posted"` and `source: "manual"` match what the builder
produces. Account balances are reconciled on the next transactions-workspace
load, same as CSV import.

- [ ] **Step 3: Build the add form**

`components/shopping/planner-add-form.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Item } from "@/lib/types";

const emptyDraft = { name: "", quantity: "", estimatedUnitPrice: "", neededBy: "" };

export function PlannerAddForm({
  items,
  isSubmitting,
  onAdd,
}: {
  items: Item[];
  isSubmitting: boolean;
  onAdd: (input: {
    name: string;
    quantity?: number;
    estimatedUnitPrice?: number;
    neededBy?: string;
  }) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);

  const submit = () => {
    if (!draft.name.trim()) return;
    onAdd({
      name: draft.name,
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      estimatedUnitPrice: parseAmountInput(draft.estimatedUnitPrice) ?? undefined,
      neededBy: draft.neededBy || undefined,
    });
    setDraft(emptyDraft);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="planner-name">Item</Label>
        <Input
          id="planner-name"
          list="planner-item-suggestions"
          value={draft.name}
          placeholder="Sugar (1kg)"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <datalist id="planner-item-suggestions">
          {items
            .filter((item) => !item.isArchived)
            .map((item) => (
              <option key={item.id} value={item.name} />
            ))}
        </datalist>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-quantity">Qty</Label>
        <Input
          id="planner-quantity"
          inputMode="numeric"
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-estimate">Est. price</Label>
        <Input
          id="planner-estimate"
          inputMode="numeric"
          value={draft.estimatedUnitPrice}
          onChange={(event) => setDraft({ ...draft, estimatedUnitPrice: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-needed-by">Needed by</Label>
        <Input
          id="planner-needed-by"
          type="date"
          value={draft.neededBy}
          onChange={(event) => setDraft({ ...draft, neededBy: event.target.value })}
        />
      </div>
      <Button disabled={isSubmitting || !draft.name.trim()} onClick={submit}>
        Add to list
      </Button>
    </div>
  );
}
```

(`datalist` is a progressive-enhancement autocomplete on the shadcn `Input`;
if review prefers the existing `select`/`popover` pattern, swap it for the
`Popover` + filtered list used elsewhere — keep the free-text-creates-item
behavior either way. The date input: reuse `components/ui/date-picker.tsx` if
its API takes a string value/onChange; otherwise the native-typed shadcn
`Input type="date"` above stands.)

- [ ] **Step 4: Build the planner list**

`components/shopping/planner-list.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/format-date";
import type { Item, ItemPriceSummary, PlannedPurchase } from "@/lib/types";
import type { PlannerGroups } from "@/lib/domain/planned-purchases";

function priceMemoryLine(summary: ItemPriceSummary | undefined): string | null {
  if (!summary?.lastPaid) return null;
  const last = summary.lastPaid;
  const lastPrice = last.unitPrice ?? last.amount;
  const parts = [
    lastPrice != null
      ? `last ${lastPrice.toLocaleString()} @ ${last.merchant}`
      : `last bought @ ${last.merchant}`,
  ];
  const best = summary.bestRecent;
  const bestPrice = best ? (best.unitPrice ?? best.amount) : undefined;
  if (best && bestPrice != null && best.lineItemId !== last.lineItemId) {
    parts.push(`best ${bestPrice.toLocaleString()} @ ${best.merchant}`);
  }
  return parts.join(" · ");
}

function PlannerSection({
  title,
  purchases,
  itemsById,
  priceSummaries,
  selectedIds,
  onToggleSelect,
  onDrop,
  onOpenHistory,
}: {
  title: string;
  purchases: PlannedPurchase[];
  itemsById: Map<string, Item>;
  priceSummaries: Map<string, ItemPriceSummary>;
  selectedIds: Set<string>;
  onToggleSelect: (purchase: PlannedPurchase) => void;
  onDrop: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
}) {
  if (purchases.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-2">
        {purchases.map((purchase) => {
          const item = itemsById.get(purchase.itemId);
          const memory = priceMemoryLine(priceSummaries.get(purchase.itemId));
          const isSelected = selectedIds.has(purchase.id);
          return (
            <li key={purchase.id} className="flex items-start justify-between gap-3">
              <label className="flex min-w-0 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={isSelected}
                  onChange={() => onToggleSelect(purchase)}
                  aria-label={`Mark ${item?.name ?? "item"} as bought`}
                />
                <span className="min-w-0">
                  <span className="block truncate">
                    {item?.name ?? "Unknown item"}
                    {purchase.quantity != null ? ` × ${purchase.quantity}` : ""}
                  </span>
                  {purchase.neededBy ? (
                    <span className="block text-xs text-muted-foreground">
                      needed by {formatDate(purchase.neededBy)}
                    </span>
                  ) : null}
                  {memory ? (
                    <button
                      type="button"
                      className="block text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => onOpenHistory(purchase.itemId)}
                    >
                      {memory}
                    </button>
                  ) : null}
                </span>
              </label>
              <span className="flex shrink-0 items-center gap-2">
                {purchase.estimatedUnitPrice != null ? (
                  <Money
                    amount={(purchase.quantity ?? 1) * purchase.estimatedUnitPrice}
                    tone="neutral"
                  />
                ) : (
                  <Badge variant="outline">no estimate</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDrop(purchase)}>
                  Drop
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PlannerList(props: {
  groups: PlannerGroups;
  itemsById: Map<string, Item>;
  priceSummaries: Map<string, ItemPriceSummary>;
  selectedIds: Set<string>;
  onToggleSelect: (purchase: PlannedPurchase) => void;
  onDrop: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
}) {
  const shared = props;
  return (
    <div className="grid gap-5">
      <PlannerSection title="Overdue" purchases={props.groups.overdue} {...shared} />
      <PlannerSection title="Upcoming" purchases={props.groups.upcoming} {...shared} />
      <PlannerSection title="Someday" purchases={props.groups.someday} {...shared} />
      {props.groups.history.length > 0 ? (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History ({props.groups.history.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {props.groups.history.map((purchase) => {
              const item = props.itemsById.get(purchase.itemId);
              return (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                >
                  <span className="min-w-0 truncate">{item?.name ?? "Unknown item"}</span>
                  <Badge variant="outline">
                    {purchase.status === "purchased" ? "Bought" : "Dropped"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
```

Global-constraint note: the native `input type="checkbox"` above violates the
"shadcn only" rule if the repo has a checkbox primitive — check
`components/ui/`; there is currently no `checkbox.tsx`, so add one via
`pnpm dlx shadcn@latest add checkbox` and use it instead of the native input.

- [ ] **Step 5: Assemble the workspace**

`components/shopping-workspace.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";

import { FeaturePageShell } from "@/components/feature-page-shell";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";

import { PlannerAddForm } from "./shopping/planner-add-form";
import { PlannerList } from "./shopping/planner-list";
import { useShoppingWorkspace } from "./shopping/use-shopping-workspace";

export function ShoppingWorkspace() {
  const workspace = useShoppingWorkspace();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [isCheckOffOpen, setIsCheckOffOpen] = useState(false);

  const itemsById = useMemo(
    () => new Map(workspace.items.map((item) => [item.id, item])),
    [workspace.items],
  );
  const selectedPurchases = workspace.purchases.filter((purchase) =>
    selectedIds.has(purchase.id),
  );

  const toggleSelect = (purchase: { id: string }) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(purchase.id)) next.delete(purchase.id);
      else next.add(purchase.id);
      return next;
    });
  };

  return (
    <FeaturePageShell
      title="Shopping"
      srOnlyTitle
      description="Plan what to buy and remember what it cost last time."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading your shopping list..."
      setupMessage="Complete onboarding before planning purchases."
    >
      <div className="grid gap-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Estimated total <Money amount={workspace.estimate.total} tone="neutral" />
            {workspace.estimate.unestimatedCount > 0
              ? ` · ${workspace.estimate.unestimatedCount} unestimated`
              : ""}
          </p>
          <Button
            size="sm"
            disabled={selectedPurchases.length === 0 || workspace.isSubmitting}
            onClick={() => setIsCheckOffOpen(true)}
          >
            Bought {selectedPurchases.length > 0 ? `(${selectedPurchases.length})` : ""}
          </Button>
        </div>

        <PlannerAddForm
          items={workspace.items}
          isSubmitting={workspace.isSubmitting}
          onAdd={(input) => void workspace.addPurchase(input)}
        />

        <PlannerList
          groups={workspace.groups}
          itemsById={itemsById}
          priceSummaries={workspace.priceSummaries}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onDrop={(purchase) => void workspace.dropPurchase(purchase)}
          onOpenHistory={(itemId) => setHistoryItemId(itemId)}
        />
      </div>
      {/* CheckOffSheet (Task 9) and ItemHistorySheet (Task 10) mount here. */}
    </FeaturePageShell>
  );
}
```

The placeholder comment is removed as Tasks 9 and 10 land; state for both
sheets is already declared so those tasks only add the components and their
mount lines. Purchased/dropped rows render in the collapsed History section
built into `PlannerList`.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. Then `pnpm dev`: `/shopping` renders in the nav, adding
"Sugar (1kg)" with estimate 3,500 shows it under Someday with the estimated
total; a second add of "sugar (1kg)" reuses the same item (no duplicate in
the datalist).

- [ ] **Step 7: Commit**

```bash
git add app/shopping components/shopping components/shopping-workspace.tsx lib/data.ts
git commit -m "Give planned purchases a home of their own"
```

---

### Task 9: Check-off flow (attach or create)

**Files:**
- Create: `components/shopping/check-off-sheet.tsx`
- Modify: `components/shopping-workspace.tsx` (mount the sheet)

**Interfaces:**
- Consumes: `workspace.checkOff(selected, target)` and `workspace.recentExpenses` from Task 8; `CheckOffTarget` type from `use-shopping-workspace.ts`; accounts and expense categories need loading — extend the Task 8 hook per Step 1.

- [ ] **Step 1: Extend the hook with accounts and categories**

In `use-shopping-workspace.ts` add to the parallel load in `refresh`:

```ts
          repositories.accounts.listByUser(loadedProfile.id),
          repositories.categories.listByUser(loadedProfile.id),
```

with state `accounts: Account[]` and `categories: Category[]`, both exported
from the hook. Also export
`expenseCategories: useMemo(() => categories.filter((category) => category.kind === "expense"), [categories])`.

- [ ] **Step 2: Build the sheet**

`components/shopping/check-off-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { estimatePlannedTotal } from "@/lib/domain/planned-purchases";
import { formatDate } from "@/lib/format-date";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Account, Category, PlannedPurchase, Transaction } from "@/lib/types";

import type { CheckOffTarget } from "./use-shopping-workspace";

export function CheckOffSheet({
  open,
  selected,
  recentExpenses,
  accounts,
  expenseCategories,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  selected: PlannedPurchase[];
  recentExpenses: Transaction[];
  accounts: Account[];
  expenseCategories: Category[];
  isSubmitting: boolean;
  onConfirm: (target: CheckOffTarget) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const [transactionId, setTransactionId] = useState("");
  const estimate = estimatePlannedTotal(selected);
  const [form, setForm] = useState({
    accountId: "",
    categoryId: "",
    payee: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    amount: "",
  });

  const createAmount = parseAmountInput(form.amount) ?? estimate.total;
  const canConfirm =
    mode === "attach"
      ? transactionId !== ""
      : form.accountId !== "" && form.categoryId !== "" && createAmount > 0;

  const confirm = () => {
    onConfirm(
      mode === "attach"
        ? { mode: "attach", transactionId }
        : {
            mode: "create",
            accountId: form.accountId,
            categoryId: form.categoryId,
            payee: form.payee,
            occurredOn: form.occurredOn,
            amount: createAmount,
          },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Record {selected.length === 1 ? "purchase" : "purchases"}</SheetTitle>
          <SheetDescription>
            Attach {selected.length === 1 ? "this item" : `these ${selected.length} items`} to
            the expense that paid for {selected.length === 1 ? "it" : "them"}.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 p-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "attach" ? "default" : "outline"}
              onClick={() => setMode("attach")}
            >
              Existing expense
            </Button>
            <Button
              size="sm"
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => setMode("create")}
            >
              New expense
            </Button>
          </div>

          {mode === "attach" ? (
            <div className="grid gap-1">
              <Label>Expense</Label>
              <Select value={transactionId} onValueChange={setTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a recent expense" />
                </SelectTrigger>
                <SelectContent>
                  {recentExpenses.map((expense) => (
                    <SelectItem key={expense.id} value={expense.id}>
                      {formatDate(expense.occurredOn)} · {expense.payee ?? "No payee"} ·{" "}
                      {expense.amount.toLocaleString()} UGX
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label>Account</Label>
                <Select
                  value={form.accountId}
                  onValueChange={(accountId) => setForm({ ...form, accountId })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Paid from" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => !account.isArchived)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(categoryId) => setForm({ ...form, categoryId })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="check-off-payee">Where (payee)</Label>
                <Input
                  id="check-off-payee"
                  value={form.payee}
                  placeholder="Mega Standard"
                  onChange={(event) => setForm({ ...form, payee: event.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="check-off-date">Date</Label>
                <Input
                  id="check-off-date"
                  type="date"
                  value={form.occurredOn}
                  onChange={(event) => setForm({ ...form, occurredOn: event.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="check-off-amount">Total amount</Label>
                <Input
                  id="check-off-amount"
                  inputMode="numeric"
                  value={form.amount}
                  placeholder={String(estimate.total)}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Estimated <Money amount={estimate.total} tone="neutral" /> from the selected
                  items; adjust to the real receipt total.
                </p>
              </div>
            </div>
          )}

          <Button disabled={!canConfirm || isSubmitting} onClick={confirm}>
            Record
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount it in the workspace**

In `components/shopping-workspace.tsx`, replace the mount-point comment with:

```tsx
      <CheckOffSheet
        open={isCheckOffOpen}
        selected={selectedPurchases}
        recentExpenses={workspace.recentExpenses}
        accounts={workspace.accounts}
        expenseCategories={workspace.expenseCategories}
        isSubmitting={workspace.isSubmitting}
        onConfirm={(target) => {
          void workspace.checkOff(selectedPurchases, target).then(() => {
            setSelectedIds(new Set());
            setIsCheckOffOpen(false);
          });
        }}
        onOpenChange={setIsCheckOffOpen}
      />
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then in `pnpm dev`:
select two planned items → Bought (2) → attach to an existing expense →
both rows move out of the active list, and the expense's detail sheet at
`/transactions/ledger` now shows both as line items. Repeat with "New
expense" and confirm the transaction appears in the ledger.

- [ ] **Step 5: Commit**

```bash
git add components/shopping components/shopping-workspace.tsx
git commit -m "Close the loop from planned to bought"
```

---

### Task 10: Item price history sheet

**Files:**
- Create: `components/shopping/item-history-sheet.tsx`
- Modify: `components/shopping-workspace.tsx` (mount)

**Interfaces:**
- Consumes: `derivePriceObservations` output — pass observations for one item plus the item, from data already loaded in the Task 8 hook. Export `observations: PriceObservation[]` from the hook (the memo already computes them inside `priceSummaries`; lift the intermediate into its own `useMemo` and export both).

- [ ] **Step 1: Lift observations out of the summary memo**

In `use-shopping-workspace.ts`:

```ts
  const observations = useMemo(
    () => derivePriceObservations(lineItems, transactions),
    [lineItems, transactions],
  );
  const priceSummaries = useMemo(
    () => summarizeItemPrices(observations, today),
    [observations, today],
  );
```

Export `observations`.

- [ ] **Step 2: Build the sheet**

`components/shopping/item-history-sheet.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format-date";
import type { Item, ItemPriceSummary, PriceObservation } from "@/lib/types";

export function ItemHistorySheet({
  item,
  observations,
  summary,
  onOpenChange,
}: {
  item: Item | null;
  observations: PriceObservation[];
  summary: ItemPriceSummary | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = [...observations].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const bestId = summary?.bestRecent?.lineItemId;

  return (
    <Sheet open={item != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{item?.name ?? "Item"}</SheetTitle>
          <SheetDescription>
            What you have paid for this, most recent first. The best price in the
            last 12 months is marked.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No purchases recorded yet. Itemize a transaction that included this
              item to start its history.
            </p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((observation) => {
                const price = observation.unitPrice ?? observation.amount;
                return (
                  <li
                    key={observation.lineItemId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {formatDate(observation.occurredOn)} · {observation.merchant}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {observation.lineItemId === bestId ? (
                        <Badge variant="outline">best price</Badge>
                      ) : null}
                      {price != null ? (
                        <Money amount={price} tone="neutral" />
                      ) : (
                        <span className="text-xs text-muted-foreground">no amount</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount it**

In `components/shopping-workspace.tsx`:

```tsx
      <ItemHistorySheet
        item={historyItemId ? (itemsById.get(historyItemId) ?? null) : null}
        observations={workspace.observations.filter(
          (observation) => observation.itemId === historyItemId,
        )}
        summary={historyItemId ? workspace.priceSummaries.get(historyItemId) : undefined}
        onOpenChange={(open) => (open ? undefined : setHistoryItemId(null))}
      />
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then in `pnpm dev`: after
Task 9's check-off, the planner row's price-memory line is clickable and opens
the history with the "best price" badge on the cheapest recent row.

- [ ] **Step 5: Commit**

```bash
git add components/shopping components/shopping-workspace.tsx
git commit -m "Show where an item was cheapest, from your own receipts"
```

---

### Task 11: Full verification and tracker note

**Files:**
- Modify: `docs/tracker.md` (Current State section)

- [ ] **Step 1: Full suite**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all clean. Fix anything that isn't before proceeding.

- [ ] **Step 2: Manual end-to-end pass**

In `pnpm dev`, walk the whole loop once: plan two items with estimates →
Bought → new expense → open the expense in the ledger detail sheet → confirm
line items and itemization summary → add one more free-text line item → open
the item's history from `/shopping` → delete the transaction from the ledger →
confirm both planned purchases returned to the active list.

- [ ] **Step 3: Record in the tracker**

Add one line to the "What is built and working" list in `docs/tracker.md`:

```markdown
- Purchase planner at `/shopping` — planned items with estimates, check-off into transaction line items, and per-item price history derived from the user's own purchases
```

- [ ] **Step 4: Commit**

```bash
git add docs/tracker.md
git commit -m "Note the purchase planner in the tracker"
```
