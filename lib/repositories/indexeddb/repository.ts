import { openFinanceDatabase, type StoreName } from "@/lib/repositories/indexeddb/client";
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

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read records from ${storeName}.`));
  });
}

async function putOne<T>(storeName: StoreName, entity: T): Promise<T> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(entity);

    request.onsuccess = () => resolve(entity);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to write record to ${storeName}.`));
  });
}

async function getOne<T>(storeName: StoreName, id: string): Promise<T | null> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read record ${id} from ${storeName}.`));
  });
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
  const profiles = await readAll<SyncProfile>("syncProfiles");
  return profiles.find((profile) => profile.userId === userId) ?? null;
}

async function enqueueSyncMutation(params: {
  entity: SyncableRecord;
  entityType: StoreName;
  operation: "upsert" | "remove";
  payload: unknown;
}) {
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
      const records = await readAll<T>(storeName);
      return records.filter((record) => record.userId === userId);
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
      const records = await repository.listByUser(userId);
      return records.filter((record) => record.occurredOn.startsWith(month));
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
      const records = await repository.listByUser(userId);
      return records.find((record) => record.period === period) ?? null;
    },
  };
}

export function createCategoryRepository(): CategoryRepository {
  const repository = createUserScopedRepository<Category>("categories");

  return {
    ...repository,
    async listDefaults(userId) {
      const categories = await repository.listByUser(userId);
      return categories.filter((category) => category.isDefault);
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
      const budgets = await repository.listByUser(userId);
      return budgets.filter((budget) => budget.month === month);
    },
  };
}

export function createInvestmentProfileRepository(): InvestmentProfileRepository {
  return {
    async getByUser(userId) {
      const records = await readAll<InvestmentProfile>("investmentProfiles");
      return records.find((record) => record.userId === userId) ?? null;
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

      return new Promise((resolve, reject) => {
        const transaction = database.transaction("resources", "readwrite");
        const store = transaction.objectStore("resources");
        store.clear();

        for (const resource of resources) {
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
      const items = await repository.listByUser(userId);
      return items.filter((item) => item.status === "pending" || item.status === "failed");
    },
  };
}
