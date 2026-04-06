import type { RepositoryBundle } from "@/lib/repositories/types";

import { createSqliteClient, type SqliteClient } from "@/lib/repositories/sqlite/client";
import {
  createSqliteAccountRepository,
  createSqliteBudgetTargetRepository,
  createSqliteCaptureEnvelopeRepository,
  createSqliteCaptureReviewItemRepository,
  createSqliteCategoryRepository,
  createSqliteCorrectionLogRepository,
  createSqliteGoalRepository,
  createSqliteImportBatchRepository,
  createSqliteInvestmentProfileRepository,
  createSqliteMonthCloseRepository,
  createSqliteRecurringObligationRepository,
  createSqliteResourceRepository,
  createSqliteSyncOutboxRepository,
  createSqliteSyncProfileRepository,
  createSqliteTransactionRepository,
  createSqliteTransactionRuleRepository,
  createSqliteUserProfileRepository,
} from "@/lib/repositories/sqlite/repository";

export function createSqliteRepositories(
  client: SqliteClient = createSqliteClient(),
): RepositoryBundle {
  return {
    userProfile: createSqliteUserProfileRepository(client),
    accounts: createSqliteAccountRepository(client),
    transactions: createSqliteTransactionRepository(client),
    captureEnvelopes: createSqliteCaptureEnvelopeRepository(client),
    captureReviewItems: createSqliteCaptureReviewItemRepository(client),
    correctionLogs: createSqliteCorrectionLogRepository(client),
    transactionRules: createSqliteTransactionRuleRepository(client),
    recurringObligations: createSqliteRecurringObligationRepository(client),
    monthCloses: createSqliteMonthCloseRepository(client),
    categories: createSqliteCategoryRepository(client),
    goals: createSqliteGoalRepository(client),
    budgets: createSqliteBudgetTargetRepository(client),
    investmentProfiles: createSqliteInvestmentProfileRepository(client),
    imports: createSqliteImportBatchRepository(client),
    resources: createSqliteResourceRepository(client),
    syncProfiles: createSqliteSyncProfileRepository(client),
    syncOutbox: createSqliteSyncOutboxRepository(client),
  };
}
