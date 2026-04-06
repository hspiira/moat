import type { StoreName } from "@/lib/repositories/indexeddb/client";
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

import type { SqliteClient } from "@/lib/repositories/sqlite/client";

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

async function readSyncProfileByUser(
  client: SqliteClient,
  userId: string,
): Promise<SyncProfile | null> {
  const records = await client.listByUser<SyncProfile>("syncProfiles", userId);
  return records[0] ?? null;
}

async function enqueueSyncMutation(
  client: SqliteClient,
  params: {
    entity: SyncableRecord;
    entityType: StoreName;
    operation: "upsert" | "remove";
    payload: unknown;
  },
) {
  if (unsyncedStoreNames.has(params.entityType)) {
    return;
  }

  const syncProfile = await readSyncProfileByUser(client, params.entity.userId);
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

  await client.upsert("syncOutbox", outboxItem);
}

function createUserScopedRepository<T extends { id: string; userId: string }>(
  client: SqliteClient,
  storeName: StoreName,
): Repository<T> {
  return {
    async getById(id) {
      return client.getById<T>(storeName, id);
    },
    async listByUser(userId) {
      return client.listByUser<T>(storeName, userId);
    },
    async upsert(entity) {
      const saved = await client.upsert(storeName, entity);
      await enqueueSyncMutation(client, {
        entity,
        entityType: storeName,
        operation: "upsert",
        payload: entity,
      });
      return saved;
    },
    async remove(id) {
      const existing = await client.getById<T>(storeName, id);
      await client.remove(storeName, id);
      if (existing) {
        await enqueueSyncMutation(client, {
          entity: existing,
          entityType: storeName,
          operation: "remove",
          payload: { id: existing.id },
        });
      }
    },
  };
}

export function createSqliteUserProfileRepository(client: SqliteClient): UserProfileRepository {
  return {
    async get() {
      const profiles = await client.listAll<UserProfile>("userProfiles");
      return profiles[0] ?? null;
    },
    async save(profile) {
      const saved = await client.upsert("userProfiles", profile);
      await enqueueSyncMutation(client, {
        entity: { id: profile.id, userId: profile.id },
        entityType: "userProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

export function createSqliteAccountRepository(client: SqliteClient) {
  return createUserScopedRepository<Account>(client, "accounts");
}

export function createSqliteTransactionRepository(client: SqliteClient): TransactionRepository {
  const repository = createUserScopedRepository<Transaction>(client, "transactions");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return client.listByFieldPrefix<Transaction>("transactions", "occurredOn", month, userId);
    },
  };
}

export function createSqliteCaptureEnvelopeRepository(client: SqliteClient) {
  return createUserScopedRepository<CaptureEnvelope>(client, "captureEnvelopes");
}

export function createSqliteCaptureReviewItemRepository(client: SqliteClient) {
  return createUserScopedRepository<CaptureReviewItem>(client, "captureReviewItems");
}

export function createSqliteCorrectionLogRepository(client: SqliteClient) {
  return createUserScopedRepository<CorrectionLog>(client, "correctionLogs");
}

export function createSqliteTransactionRuleRepository(
  client: SqliteClient,
): TransactionRuleRepository {
  return createUserScopedRepository<TransactionRule>(client, "transactionRules");
}

export function createSqliteRecurringObligationRepository(
  client: SqliteClient,
): RecurringObligationRepository {
  return createUserScopedRepository<RecurringObligation>(client, "recurringObligations");
}

export function createSqliteMonthCloseRepository(client: SqliteClient): MonthCloseRepository {
  const repository = createUserScopedRepository<MonthClose>(client, "monthCloses");

  return {
    ...repository,
    async getByPeriod(userId, period) {
      const records = await client.listByFields<MonthClose>("monthCloses", [
        { field: "userId", value: userId },
        { field: "period", value: period },
      ]);
      return records[0] ?? null;
    },
  };
}

export function createSqliteCategoryRepository(client: SqliteClient): CategoryRepository {
  const repository = createUserScopedRepository<Category>(client, "categories");

  return {
    ...repository,
    async listDefaults(userId) {
      return client.listByFields<Category>("categories", [
        { field: "userId", value: userId },
        { field: "isDefault", value: true },
      ]);
    },
  };
}

export function createSqliteGoalRepository(client: SqliteClient): GoalRepository {
  return createUserScopedRepository<Goal>(client, "goals");
}

export function createSqliteBudgetTargetRepository(
  client: SqliteClient,
): BudgetTargetRepository {
  const repository = createUserScopedRepository<BudgetTarget>(client, "budgets");

  return {
    ...repository,
    async listByMonth(userId, month) {
      return client.listByFields<BudgetTarget>("budgets", [
        { field: "userId", value: userId },
        { field: "month", value: month },
      ]);
    },
  };
}

export function createSqliteInvestmentProfileRepository(
  client: SqliteClient,
): InvestmentProfileRepository {
  return {
    async getByUser(userId) {
      const records = await client.listByUser<InvestmentProfile>("investmentProfiles", userId);
      return records[0] ?? null;
    },
    async save(profile) {
      const saved = await client.upsert("investmentProfiles", profile);
      await enqueueSyncMutation(client, {
        entity: profile,
        entityType: "investmentProfiles",
        operation: "upsert",
        payload: profile,
      });
      return saved;
    },
  };
}

export function createSqliteImportBatchRepository(client: SqliteClient): ImportBatchRepository {
  return createUserScopedRepository<ImportBatch>(client, "imports");
}

export function createSqliteResourceRepository(client: SqliteClient): ResourceRepository {
  return {
    async list() {
      return client.listAll<ResourceLink>("resources");
    },
    async replaceAll(resources) {
      return client.replaceAll("resources", resources);
    },
  };
}

export function createSqliteSyncProfileRepository(client: SqliteClient): SyncProfileRepository {
  return {
    async getByUser(userId) {
      return readSyncProfileByUser(client, userId);
    },
    async save(profile) {
      return client.upsert("syncProfiles", profile);
    },
  };
}

export function createSqliteSyncOutboxRepository(client: SqliteClient): SyncOutboxRepository {
  const repository = createUserScopedRepository<SyncOutboxItem>(client, "syncOutbox");

  return {
    ...repository,
    async listPendingByUser(userId) {
      return client.listByFieldIn<SyncOutboxItem>(
        "syncOutbox",
        "status",
        ["pending", "failed"],
        userId,
      );
    },
  };
}
