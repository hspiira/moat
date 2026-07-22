import {
  openFinanceDatabase,
  storeNames,
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
  hasActiveRecordCryptoKey,
  indexQueryKey,
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

/**
 * Decrypt a batch of records, skipping any that cannot be read (corrupt,
 * key mismatch, or a mid-session auto-lock) instead of failing the whole
 * list — so one bad record can never blank an entire page.
 */
async function decryptRecords<T>(storeName: StoreName, records: unknown[]): Promise<T[]> {
  const decrypted = await Promise.all(
    records.map(async (record): Promise<T | null> => {
      try {
        return await decryptRecordFromStorage<T>(record);
      } catch (error) {
        const id = (record as { id?: unknown })?.id;
        console.warn(`Moat: skipped an unreadable ${storeName} record (${String(id)}).`, error);
        return null;
      }
    }),
  );

  return decrypted.filter((record) => record != null) as T[];
}

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

  return decryptRecords<T>(storeName, records);
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

  return decryptRecords<T>(storeName, records);
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

/**
 * Every store that holds encryptable user data (everything except `meta`,
 * which carries schema-version bookkeeping and must stay plaintext for
 * migrations). Used by the re-key primitives below.
 */
const ENCRYPTABLE_STORE_NAMES: StoreName[] = Object.values(storeNames).filter(
  (name): name is StoreName => name !== "meta",
);

async function readStoreRaw(storeName: StoreName): Promise<unknown[]> {
  const database = await openFinanceDatabase();
  return new Promise<unknown[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read records from ${storeName}.`));
  });
}

/**
 * Read and decrypt every record in every encryptable store using the current
 * active key. Used to re-key the whole database when enabling, disabling, or
 * changing encryption — captured in memory so the key can be switched between
 * snapshot and write-back without losing data.
 */
export async function snapshotAllRecords(): Promise<Map<StoreName, unknown[]>> {
  const snapshot = new Map<StoreName, unknown[]>();
  for (const storeName of ENCRYPTABLE_STORE_NAMES) {
    const raw = await readStoreRaw(storeName);
    snapshot.set(storeName, await decryptRecords(storeName, raw));
  }
  return snapshot;
}

/**
 * Write a snapshot back, encrypting with whatever key is currently active
 * (or storing plaintext when none is). Pair with snapshotAllRecords to re-key.
 */
export async function writeAllRecords(snapshot: Map<StoreName, unknown[]>): Promise<void> {
  for (const [storeName, records] of snapshot) {
    for (const record of records) {
      await putOne(storeName, record as { id: string });
    }
  }
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

  try {
    return await decryptRecordFromStorage<T>(record);
  } catch (error) {
    console.warn(`Moat: skipped an unreadable ${storeName} record (${id}).`, error);
    return null;
  }
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
  const profiles = await readAllByIndex<SyncProfile>(
    "syncProfiles",
    USER_ID_INDEX,
    await indexQueryKey("syncProfiles", ["userId"], [userId]),
  );
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
      return readAllByIndex<T>(
        storeName,
        USER_ID_INDEX,
        await indexQueryKey(storeName, ["userId"], [userId]),
      );
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
      if (hasActiveRecordCryptoKey()) {
        // Blinded occurredOn stores the month hash, so match it exactly.
        return readAllByIndex<Transaction>(
          "transactions",
          USER_ID_OCCURRED_ON_INDEX,
          await indexQueryKey("transactions", ["userId", "occurredOn"], [userId, month]),
        );
      }
      // Plaintext mode: occurredOn is an ordered ISO date, so range-match the month.
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
        await indexQueryKey("monthCloses", ["userId", "period"], [userId, period]),
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
        await indexQueryKey("categories", ["userId", "isDefault"], [userId, true]),
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
        await indexQueryKey("budgets", ["userId", "month"], [userId, month]),
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
        await indexQueryKey("investmentProfiles", ["userId"], [userId]),
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
          await indexQueryKey("syncOutbox", ["userId", "status"], [userId, "pending"]),
        ),
        readAllByIndex<SyncOutboxItem>(
          "syncOutbox",
          USER_ID_STATUS_INDEX,
          await indexQueryKey("syncOutbox", ["userId", "status"], [userId, "failed"]),
        ),
      ]);
      return [...pending, ...failed];
    },
  };
}
