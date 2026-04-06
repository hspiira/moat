import type { SyncOutboxItem } from "@/lib/types";

export type SyncEntityType =
  | "userProfiles"
  | "accounts"
  | "transactions"
  | "categories"
  | "goals"
  | "budgets"
  | "investmentProfiles"
  | "transactionRules"
  | "recurringObligations"
  | "monthCloses";

export type SyncConflictStrategy = "client_wins" | "server_wins" | "manual_review";

export const syncConflictStrategies: Record<SyncEntityType, SyncConflictStrategy> = {
  userProfiles: "client_wins",
  accounts: "manual_review",
  transactions: "manual_review",
  categories: "client_wins",
  goals: "manual_review",
  budgets: "manual_review",
  investmentProfiles: "client_wins",
  transactionRules: "client_wins",
  recurringObligations: "manual_review",
  monthCloses: "server_wins",
};

export function getSyncConflictStrategy(entityType: string): SyncConflictStrategy {
  return syncConflictStrategies[entityType as SyncEntityType] ?? "manual_review";
}

export function shouldBlockAutomaticSync(item: Pick<SyncOutboxItem, "entityType" | "operation">) {
  if (item.operation === "remove") {
    return getSyncConflictStrategy(item.entityType) === "manual_review";
  }

  return getSyncConflictStrategy(item.entityType) === "manual_review";
}
