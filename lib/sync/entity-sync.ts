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

const entityStrategies: Record<SyncableEntityType, ConflictStrategy> = {
  userProfiles: "client_wins",
  categories: "client_wins",
  investmentProfiles: "client_wins",
  transactionRules: "client_wins",
  monthCloses: "server_wins",
  accounts: "manual_review",
  transactions: "manual_review",
  goals: "manual_review",
  budgets: "manual_review",
  recurringObligations: "manual_review",
};

export function getConflictStrategy(entityType: string): ConflictStrategy {
  return entityStrategies[entityType as SyncableEntityType] ?? "manual_review";
}

export function isSyncableEntityType(entityType: string): entityType is SyncableEntityType {
  return entityType in entityStrategies;
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

  switch (record.entityType) {
    case "userProfiles":
      await repositories.userProfile.save(payload as UserProfile);
      return;
    case "accounts":
      await repositories.accounts.upsert(payload as Account);
      return;
    case "transactions":
      await repositories.transactions.upsert(payload as Transaction);
      return;
    case "transactionRules":
      await repositories.transactionRules.upsert(payload as TransactionRule);
      return;
    case "recurringObligations":
      await repositories.recurringObligations.upsert(payload as RecurringObligation);
      return;
    case "monthCloses":
      await repositories.monthCloses.upsert(payload as MonthClose);
      return;
    case "categories":
      await repositories.categories.upsert(payload as Category);
      return;
    case "goals":
      await repositories.goals.upsert(payload as Goal);
      return;
    case "budgets":
      await repositories.budgets.upsert(payload as BudgetTarget);
      return;
    case "investmentProfiles":
      await repositories.investmentProfiles.save(payload as InvestmentProfile);
      return;
  }
}

async function removeEntity(
  repositories: RepositoryBundle,
  entityType: SyncableEntityType,
  entityId: string,
) {
  switch (entityType) {
    case "userProfiles":
      return;
    case "accounts":
      await repositories.accounts.remove(entityId);
      return;
    case "transactions":
      await repositories.transactions.remove(entityId);
      return;
    case "transactionRules":
      await repositories.transactionRules.remove(entityId);
      return;
    case "recurringObligations":
      await repositories.recurringObligations.remove(entityId);
      return;
    case "monthCloses":
      await repositories.monthCloses.remove(entityId);
      return;
    case "categories":
      await repositories.categories.remove(entityId);
      return;
    case "goals":
      await repositories.goals.remove(entityId);
      return;
    case "budgets":
      await repositories.budgets.remove(entityId);
      return;
    case "investmentProfiles":
      return;
  }
}
