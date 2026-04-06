import {
  openFinanceDatabase,
  USER_ID_INDEX,
  USER_ID_IS_DEFAULT_INDEX,
  USER_ID_MONTH_INDEX,
  USER_ID_OCCURRED_ON_INDEX,
  USER_ID_PERIOD_INDEX,
  USER_ID_STATUS_INDEX,
  type StoreName,
} from "@/lib/repositories/indexeddb/client";
import {
  decryptRecordFromStorage,
  encryptRecordForStorage,
} from "@/lib/security/record-crypto";
import { shouldSuppressSyncMutation } from "@/lib/sync/mutation-scope";
import type {
  BudgetTargetRepository,
  CategoryRepository,
  GoalRepository,
  ImportBatchRepository,
  InvestmentProfileRepository,
  MonthCloseRepository,
  RecurringObligationRepository,
  Repository,
  ResourceRepository,
  SyncOutboxRepository,
  SyncProfileRepository,
  TransactionRepository,
  TransactionRuleRepository,
  UserProfileRepository,
} from "@/lib/repositories/types";
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

const unsyncedStoreNames = new Set<StoreName>([
  "captureEnvelopes",
  "captureReviewItems",
  "correctionLogs",
  "imports",
  "resources",
  "syncProfiles",
  "syncOutbox",
]);

async function readAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openFinanceDatabase();

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read records from ${storeName}.`));
  });

  return Promise.all(records.map((record) => decryptRecordFromStorage<T>(record))) as Promise<T[]>;
}

async function readAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const database = await openFinanceDatabase();

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(query);

    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read indexed records from ${storeName}.`));
  });

  return Promise.all(records.map((record) => decryptRecordFromStorage<T>(record))) as Promise<T[]>;
}

async function putOne<T>(storeName: StoreName, entity: T): Promise<T> {
  const database = await openFinanceDatabase();
  const storedEntity = await encryptRecordForStorage(
    storeName,
    entity as T & { id: string },
  );

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(storedEntity);

    request.onsuccess = () => resolve(entity);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to write record to ${storeName}.`));
  });
}

async function getOne<T>(storeName: StoreName, id: string): Promise<T | null> {
  const database = await openFinanceDatabase();

  const record = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read record ${id} from ${storeName}.`));
  });

  return decryptRecordFromStorage<T>(record);
}

async function removeOne(storeName: StoreName, id: string): Promise<void> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to delete record ${id} from ${storeName}.`));
  });
}

async function readSyncProfileByUser(userId: string): Promise<SyncProfile | null> {
  const profiles = await readAllByIndex<SyncProfile>("syncProfiles", USER_ID_INDEX, userId);
  return profiles[0] ?? null;
}

async function enqueueSyncMutation(params: {
  entity: SyncableRecord;
  entityType: StoreName;
  operation: "upsert" | "remove";
  payload: unknown;
}) {
  if (shouldSuppressSyncMutation()) {
    return;
  }

  if (unsyncedStoreNames.has(params.entityType)) {
    return;
  }

  const syncProfile = await readSyncProfileByUser(params.entity.userId);
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

  await putOne("syncOutbox", outboxItem);
}

function createUserScopedRepository<T extends { id: string; userId: string }>(
  storeName: StoreName,
): Repository<T> {
  return {
    async getById(id) {
      return getOne<T>(storeName, id);
    },
    async listByUser(userId) {
      return readAllByIndex<T>(storeName, USER_ID_INDEX, userId);
    },
    async upsert(entity) {
      const saved = await putOne(storeName, entity);
      await enqueueSyncMutation({
        entity,
        entityType: storeName,
        operation: "upsert",
        payload: entity,
      });
      return saved;
    },
    async remove(id) {
      const existing = await getOne<T>(storeName, id);
      await removeOne(storeName, id);
      if (existing) {
        await enqueueSyncMutation({
          entity: existing,
          entityType: storeName,
          operation: "remove",
          payload: { id: existing.id },
        });
      }
    },
  };
}

export function createUserProfileRepository(): UserProfileRepository {
  return {
    async get() {
      const profiles = await readAll<UserProfile>("userProfiles");
      return profiles[0] ?? null;
    },
    async save(profile) {
      const saved = await putOne("userProfiles", profile);
      await enqueueSyncMutation({
        entity: { id: profile.id, userId: profile.id },
        entityType: "userProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

export function createAccountRepository() {
  return createUserScopedRepository<Account>("accounts");
}

export function createTransactionRepository(): TransactionRepository {
  const repository = createUserScopedRepository<Transaction>("transactions");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return readAllByIndex<Transaction>(
        "transactions",
        USER_ID_OCCURRED_ON_INDEX,
        IDBKeyRange.bound([userId, month], [userId, `${month}\uffff`]),
      );
    },
  };
}

export function createCaptureEnvelopeRepository() {
  return createUserScopedRepository<CaptureEnvelope>("captureEnvelopes");
}

export function createCaptureReviewItemRepository() {
  return createUserScopedRepository<CaptureReviewItem>("captureReviewItems");
}

export function createCorrectionLogRepository() {
  return createUserScopedRepository<CorrectionLog>("correctionLogs");
}

export function createTransactionRuleRepository(): TransactionRuleRepository {
  return createUserScopedRepository<TransactionRule>("transactionRules");
}

export function createRecurringObligationRepository(): RecurringObligationRepository {
  return createUserScopedRepository<RecurringObligation>("recurringObligations");
}

export function createMonthCloseRepository(): MonthCloseRepository {
  const repository = createUserScopedRepository<MonthClose>("monthCloses");

  return {
    ...repository,
    async getByPeriod(userId, period) {
      const records = await readAllByIndex<MonthClose>(
        "monthCloses",
        USER_ID_PERIOD_INDEX,
        IDBKeyRange.only([userId, period]),
      );
      return records[0] ?? null;
    },
  };
}

export function createCategoryRepository(): CategoryRepository {
  const repository = createUserScopedRepository<Category>("categories");

  return {
    ...repository,
    async listDefaults(userId) {
      return readAllByIndex<Category>(
        "categories",
        USER_ID_IS_DEFAULT_INDEX,
        IDBKeyRange.only([userId, true]),
      );
    },
  };
}

export function createGoalRepository(): GoalRepository {
  return createUserScopedRepository<Goal>("goals");
}

export function createBudgetTargetRepository(): BudgetTargetRepository {
  const repository = createUserScopedRepository<BudgetTarget>("budgets");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return readAllByIndex<BudgetTarget>(
        "budgets",
        USER_ID_MONTH_INDEX,
        IDBKeyRange.only([userId, month]),
      );
    },
  };
}

export function createInvestmentProfileRepository(): InvestmentProfileRepository {
  return {
    async getByUser(userId) {
      const records = await readAllByIndex<InvestmentProfile>(
        "investmentProfiles",
        USER_ID_INDEX,
        userId,
      );
      return records[0] ?? null;
    },
    async save(profile) {
      const saved = await putOne("investmentProfiles", profile);
      await enqueueSyncMutation({
        entity: profile,
        entityType: "investmentProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

export function createImportBatchRepository(): ImportBatchRepository {
  return createUserScopedRepository<ImportBatch>("imports");
}

export function createResourceRepository(): ResourceRepository {
  return {
    async list() {
      return readAll<ResourceLink>("resources");
    },
    async replaceAll(resources) {
      const database = await openFinanceDatabase();
      const storedResources = await Promise.all(
        resources.map((resource) => encryptRecordForStorage("resources", resource)),
      );

      return new Promise<ResourceLink[]>((resolve, reject) => {
        const transaction = database.transaction("resources", "readwrite");
        const store = transaction.objectStore("resources");
        store.clear();

        for (const resource of storedResources) {
          store.put(resource);
        }

        transaction.oncomplete = () => resolve(resources);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Unable to replace resources."));
      });
    },
  };
}

export function createSyncProfileRepository(): SyncProfileRepository {
  return {
    async getByUser(userId) {
      return readSyncProfileByUser(userId);
    },
    async save(profile) {
      return putOne("syncProfiles", profile);
    },
  };
}

export function createSyncOutboxRepository(): SyncOutboxRepository {
  const repository = createUserScopedRepository<SyncOutboxItem>("syncOutbox");

  return {
    ...repository,
    async listPendingByUser(userId) {
      const [pending, failed] = await Promise.all([
        readAllByIndex<SyncOutboxItem>(
          "syncOutbox",
          USER_ID_STATUS_INDEX,
          IDBKeyRange.only([userId, "pending"]),
        ),
        readAllByIndex<SyncOutboxItem>(
          "syncOutbox",
          USER_ID_STATUS_INDEX,
          IDBKeyRange.only([userId, "failed"]),
        ),
      ]);
      return [...pending, ...failed];
    },
  };
}
