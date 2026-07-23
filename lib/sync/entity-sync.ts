import type { RepositoryBundle } from "@/lib/repositories/types";
import type { SyncPullRecord } from "@/lib/sync/types";
import type {
  Account,
  BudgetTarget,
  Category,
  Goal,
  InvestmentProfile,
  MonthClose,
  RecurringObligation,
  Transaction,
  TransactionRule,
  UserProfile,
} from "@/lib/types";

type SyncableEntityType =
  | "userProfiles"
  | "accounts"
  | "transactions"
  | "transactionRules"
  | "recurringObligations"
  | "monthCloses"
  | "categories"
  | "goals"
  | "budgets"
  | "investmentProfiles";

type ConflictStrategy = "client_wins" | "server_wins" | "manual_review";

type EntityDefinition = {
  strategy: ConflictStrategy;
  // Resolved values are intentionally discarded by the callers below; the
  // repository methods return the persisted entity, hence the wide return type.
  upsert: (repositories: RepositoryBundle, payload: Record<string, unknown>) => Promise<unknown>;
  remove: (repositories: RepositoryBundle, entityId: string) => Promise<unknown>;
};

const noop = async () => {};

// Single source of truth for every syncable entity: its conflict strategy plus
// how a pulled record is applied (upsert) or removed. Adding a new syncable
// entity means adding exactly one entry here.
const entityDefinitions: Record<SyncableEntityType, EntityDefinition> = {
  userProfiles: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.userProfile.save(payload as UserProfile),
    remove: noop,
  },
  accounts: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.accounts.upsert(payload as Account),
    remove: (repositories, entityId) => repositories.accounts.remove(entityId),
  },
  transactions: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.transactions.upsert(payload as Transaction),
    remove: (repositories, entityId) => repositories.transactions.remove(entityId),
  },
  transactionRules: {
    strategy: "client_wins",
    upsert: (repositories, payload) =>
      repositories.transactionRules.upsert(payload as TransactionRule),
    remove: (repositories, entityId) => repositories.transactionRules.remove(entityId),
  },
  recurringObligations: {
    strategy: "manual_review",
    upsert: (repositories, payload) =>
      repositories.recurringObligations.upsert(payload as RecurringObligation),
    remove: (repositories, entityId) => repositories.recurringObligations.remove(entityId),
  },
  monthCloses: {
    strategy: "server_wins",
    upsert: (repositories, payload) => repositories.monthCloses.upsert(payload as MonthClose),
    remove: (repositories, entityId) => repositories.monthCloses.remove(entityId),
  },
  categories: {
    strategy: "client_wins",
    upsert: (repositories, payload) => repositories.categories.upsert(payload as Category),
    remove: (repositories, entityId) => repositories.categories.remove(entityId),
  },
  goals: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.goals.upsert(payload as Goal),
    remove: (repositories, entityId) => repositories.goals.remove(entityId),
  },
  budgets: {
    strategy: "manual_review",
    upsert: (repositories, payload) => repositories.budgets.upsert(payload as BudgetTarget),
    remove: (repositories, entityId) => repositories.budgets.remove(entityId),
  },
  investmentProfiles: {
    strategy: "client_wins",
    upsert: (repositories, payload) =>
      repositories.investmentProfiles.save(payload as InvestmentProfile),
    remove: noop,
  },
};

export function getConflictStrategy(entityType: string): ConflictStrategy {
  return entityDefinitions[entityType as SyncableEntityType]?.strategy ?? "manual_review";
}

export function isSyncableEntityType(entityType: string): entityType is SyncableEntityType {
  return entityType in entityDefinitions;
}

export async function applyPulledRecord(
  repositories: RepositoryBundle,
  record: SyncPullRecord,
): Promise<void> {
  if (!isSyncableEntityType(record.entityType)) {
    throw new Error(`Unsupported synced entity type: ${record.entityType}`);
  }

  if (record.deleted) {
    await removeEntity(repositories, record.entityType, record.entityId);
    return;
  }

  if (!record.payload) {
    throw new Error(`Pulled record ${record.entityType}:${record.entityId} is missing payload.`);
  }

  const payload = JSON.parse(record.payload) as Record<string, unknown>;
  await entityDefinitions[record.entityType].upsert(repositories, payload);
}

async function removeEntity(
  repositories: RepositoryBundle,
  entityType: SyncableEntityType,
  entityId: string,
) {
  await entityDefinitions[entityType].remove(repositories, entityId);
}
