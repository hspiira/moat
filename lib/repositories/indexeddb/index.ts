import {
  createAccountRepository,
  createBudgetTargetRepository,
  createCaptureEnvelopeRepository,
  createCaptureReviewItemRepository,
  createCategoryRepository,
  createCorrectionLogRepository,
  createGoalRepository,
  createImportBatchRepository,
  createInvestmentProfileRepository,
  createMonthCloseRepository,
  createRecurringObligationRepository,
  createResourceRepository,
  createSyncOutboxRepository,
  createSyncProfileRepository,
  createTransactionRepository,
  createTransactionRuleRepository,
  createUserProfileRepository,
} from "@/lib/repositories/indexeddb/repository";
import type { RepositoryBundle } from "@/lib/repositories/types";

export function createIndexedDbRepositories(): RepositoryBundle {
  return {
    userProfile: createUserProfileRepository(),
    accounts: createAccountRepository(),
    transactions: createTransactionRepository(),
    captureEnvelopes: createCaptureEnvelopeRepository(),
    captureReviewItems: createCaptureReviewItemRepository(),
    correctionLogs: createCorrectionLogRepository(),
    transactionRules: createTransactionRuleRepository(),
    recurringObligations: createRecurringObligationRepository(),
    monthCloses: createMonthCloseRepository(),
    categories: createCategoryRepository(),
    goals: createGoalRepository(),
    budgets: createBudgetTargetRepository(),
    investmentProfiles: createInvestmentProfileRepository(),
    imports: createImportBatchRepository(),
    resources: createResourceRepository(),
    syncProfiles: createSyncProfileRepository(),
    syncOutbox: createSyncOutboxRepository(),
  };
}
