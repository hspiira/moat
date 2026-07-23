import type { StorageAdapter } from "@/lib/repositories/adapter";
import type { StoreName } from "@/lib/repositories/store-names";
import type {
  BudgetTargetRepository,
  CategoryRepository,
  GoalRepository,
  ImportBatchRepository,
  InvestmentProfileRepository,
  MonthCloseRepository,
  RecurringObligationRepository,
  Repository,
  RepositoryBundle,
  ResourceRepository,
  SyncOutboxRepository,
  SyncProfileRepository,
  TransactionRepository,
  TransactionRuleRepository,
  UserProfileRepository,
} from "@/lib/repositories/types";
import { shouldSuppressSyncMutation } from "@/lib/sync/mutation-scope";
import type {
  Account,
  BudgetTarget,
  CaptureEnvelope,
  CaptureReviewItem,
  Category,
  CorrectionLog,
  Goal,
  ImportBatch,
  InvestmentProfile,
  MonthClose,
  RecurringObligation,
  ResourceLink,
  SyncOutboxItem,
  SyncProfile,
  Transaction,
  TransactionRule,
  UserProfile,
} from "@/lib/types";

type SyncableRecord = { id: string; userId: string };

/**
 * Stores whose records never leave the device, so a change to them must never
 * enqueue a hosted-sync mutation.
 */
const unsyncedStoreNames = new Set<StoreName>([
  "captureEnvelopes",
  "captureReviewItems",
  "correctionLogs",
  "imports",
  "resources",
  "syncProfiles",
  "syncOutbox",
]);

/**
 * Materialize one stored record, skipping (with a warning) anything that can't
 * be read — corrupt, key-mismatched, or written by a misbehaving backend — so
 * a single bad record can never blank an entire list. `null` is a genuine
 * "not found" and is passed through silently.
 */
async function hydrateOne<T>(
  adapter: StorageAdapter,
  store: StoreName,
  raw: unknown,
): Promise<T | null> {
  if (raw == null) {
    return null;
  }
  try {
    return await adapter.deserialize<T>(store, raw);
  } catch (error) {
    const id = (raw as { id?: unknown })?.id;
    console.warn(`Moat: skipped an unreadable ${store} record (${String(id)}).`, error);
    return null;
  }
}

export async function hydrateMany<T>(
  adapter: StorageAdapter,
  store: StoreName,
  raw: unknown[],
): Promise<T[]> {
  const hydrated = await Promise.all(raw.map((record) => hydrateOne<T>(adapter, store, record)));
  return hydrated.filter((record) => record != null) as T[];
}

async function readSyncProfileByUser(
  adapter: StorageAdapter,
  userId: string,
): Promise<SyncProfile | null> {
  const profiles = await hydrateMany<SyncProfile>(
    adapter,
    "syncProfiles",
    await adapter.listByUser("syncProfiles", userId),
  );
  return profiles[0] ?? null;
}

async function enqueueSyncMutation(
  adapter: StorageAdapter,
  params: {
    entity: SyncableRecord;
    entityType: StoreName;
    operation: "upsert" | "remove";
    payload: unknown;
  },
) {
  if (shouldSuppressSyncMutation()) {
    return;
  }

  if (unsyncedStoreNames.has(params.entityType)) {
    return;
  }

  const syncProfile = await readSyncProfileByUser(adapter, params.entity.userId);
  if (!syncProfile?.hostedSyncEnabled || syncProfile.mode !== "hosted_opt_in") {
    return;
  }

  const timestamp = new Date().toISOString();
  const outboxItem: SyncOutboxItem = {
    id: `sync-outbox:${crypto.randomUUID()}`,
    userId: params.entity.userId,
    entityType: params.entityType,
    entityId: params.entity.id,
    operation: params.operation,
    payload: JSON.stringify(params.payload),
    status: "pending",
    attempts: 0,
    queuedAt: timestamp,
    updatedAt: timestamp,
  };

  await adapter.upsert("syncOutbox", outboxItem);
}

function createUserScopedRepository<T extends { id: string; userId: string }>(
  adapter: StorageAdapter,
  storeName: StoreName,
): Repository<T> {
  return {
    async getById(id) {
      return hydrateOne<T>(adapter, storeName, await adapter.getById(storeName, id));
    },
    async listByUser(userId) {
      return hydrateMany<T>(adapter, storeName, await adapter.listByUser(storeName, userId));
    },
    async upsert(entity) {
      const saved = await adapter.upsert(storeName, entity);
      await enqueueSyncMutation(adapter, {
        entity,
        entityType: storeName,
        operation: "upsert",
        payload: entity,
      });
      return saved;
    },
    async remove(id) {
      const existing = await hydrateOne<T>(adapter, storeName, await adapter.getById(storeName, id));
      await adapter.remove(storeName, id);
      if (existing) {
        await enqueueSyncMutation(adapter, {
          entity: existing,
          entityType: storeName,
          operation: "remove",
          payload: { id: existing.id },
        });
      }
    },
  };
}

function createUserProfileRepository(adapter: StorageAdapter): UserProfileRepository {
  return {
    async get() {
      const profiles = await hydrateMany<UserProfile>(
        adapter,
        "userProfiles",
        await adapter.listAll("userProfiles"),
      );
      return profiles[0] ?? null;
    },
    async save(profile) {
      const saved = await adapter.upsert("userProfiles", profile);
      await enqueueSyncMutation(adapter, {
        entity: { id: profile.id, userId: profile.id },
        entityType: "userProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

function createTransactionRepository(adapter: StorageAdapter): TransactionRepository {
  const repository = createUserScopedRepository<Transaction>(adapter, "transactions");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return hydrateMany<Transaction>(
        adapter,
        "transactions",
        await adapter.listByFieldPrefix("transactions", "occurredOn", month, userId),
      );
    },
  };
}

function createMonthCloseRepository(adapter: StorageAdapter): MonthCloseRepository {
  const repository = createUserScopedRepository<MonthClose>(adapter, "monthCloses");

  return {
    ...repository,
    async getByPeriod(userId, period) {
      const records = await hydrateMany<MonthClose>(
        adapter,
        "monthCloses",
        await adapter.listByFields("monthCloses", [
          { field: "userId", value: userId },
          { field: "period", value: period },
        ]),
      );
      return records[0] ?? null;
    },
  };
}

function createCategoryRepository(adapter: StorageAdapter): CategoryRepository {
  const repository = createUserScopedRepository<Category>(adapter, "categories");

  return {
    ...repository,
    async listDefaults(userId) {
      return hydrateMany<Category>(
        adapter,
        "categories",
        await adapter.listByFields("categories", [
          { field: "userId", value: userId },
          { field: "isDefault", value: true },
        ]),
      );
    },
  };
}

function createBudgetTargetRepository(adapter: StorageAdapter): BudgetTargetRepository {
  const repository = createUserScopedRepository<BudgetTarget>(adapter, "budgets");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return hydrateMany<BudgetTarget>(
        adapter,
        "budgets",
        await adapter.listByFields("budgets", [
          { field: "userId", value: userId },
          { field: "month", value: month },
        ]),
      );
    },
  };
}

function createInvestmentProfileRepository(adapter: StorageAdapter): InvestmentProfileRepository {
  return {
    async getByUser(userId) {
      const records = await hydrateMany<InvestmentProfile>(
        adapter,
        "investmentProfiles",
        await adapter.listByUser("investmentProfiles", userId),
      );
      return records[0] ?? null;
    },
    async save(profile) {
      const saved = await adapter.upsert("investmentProfiles", profile);
      await enqueueSyncMutation(adapter, {
        entity: profile,
        entityType: "investmentProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

function createResourceRepository(adapter: StorageAdapter): ResourceRepository {
  return {
    async list() {
      return hydrateMany<ResourceLink>(adapter, "resources", await adapter.listAll("resources"));
    },
    async replaceAll(resources) {
      return adapter.replaceAll("resources", resources);
    },
  };
}

function createSyncProfileRepository(adapter: StorageAdapter): SyncProfileRepository {
  return {
    async getByUser(userId) {
      return readSyncProfileByUser(adapter, userId);
    },
    async save(profile) {
      return adapter.upsert("syncProfiles", profile);
    },
  };
}

function createSyncOutboxRepository(adapter: StorageAdapter): SyncOutboxRepository {
  const repository = createUserScopedRepository<SyncOutboxItem>(adapter, "syncOutbox");

  return {
    ...repository,
    async listPendingByUser(userId) {
      return hydrateMany<SyncOutboxItem>(
        adapter,
        "syncOutbox",
        await adapter.listByFieldIn("syncOutbox", "status", ["pending", "failed"], userId),
      );
    },
  };
}

/**
 * Assemble the full repository bundle for a backend from its storage adapter.
 * This is the single implementation of repository behavior; the IndexedDB and
 * SQLite entry points differ only in the adapter they pass in.
 */
export function createRepositoryBundle(adapter: StorageAdapter): RepositoryBundle {
  return {
    userProfile: createUserProfileRepository(adapter),
    accounts: createUserScopedRepository<Account>(adapter, "accounts"),
    transactions: createTransactionRepository(adapter),
    captureEnvelopes: createUserScopedRepository<CaptureEnvelope>(adapter, "captureEnvelopes"),
    captureReviewItems: createUserScopedRepository<CaptureReviewItem>(
      adapter,
      "captureReviewItems",
    ),
    correctionLogs: createUserScopedRepository<CorrectionLog>(adapter, "correctionLogs"),
    transactionRules: createUserScopedRepository<TransactionRule>(
      adapter,
      "transactionRules",
    ) satisfies TransactionRuleRepository,
    recurringObligations: createUserScopedRepository<RecurringObligation>(
      adapter,
      "recurringObligations",
    ) satisfies RecurringObligationRepository,
    monthCloses: createMonthCloseRepository(adapter),
    categories: createCategoryRepository(adapter),
    goals: createUserScopedRepository<Goal>(adapter, "goals") satisfies GoalRepository,
    budgets: createBudgetTargetRepository(adapter),
    investmentProfiles: createInvestmentProfileRepository(adapter),
    imports: createUserScopedRepository<ImportBatch>(adapter, "imports") satisfies ImportBatchRepository,
    resources: createResourceRepository(adapter),
    syncProfiles: createSyncProfileRepository(adapter),
    syncOutbox: createSyncOutboxRepository(adapter),
  };
}
