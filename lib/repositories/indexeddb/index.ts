import {
  createAccountRepository,
  createBudgetTargetRepository,
  createCaptureEnvelopeRepository,
  createCaptureReviewItemRepository,
  createCategoryRepository,
  createGoalRepository,
  createImportBatchRepository,
  createInvestmentProfileRepository,
  createMonthCloseRepository,
  createRecurringObligationRepository,
  createResourceRepository,
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
    transactionRules: createTransactionRuleRepository(),
    recurringObligations: createRecurringObligationRepository(),
    monthCloses: createMonthCloseRepository(),
    categories: createCategoryRepository(),
    goals: createGoalRepository(),
    budgets: createBudgetTargetRepository(),
    investmentProfiles: createInvestmentProfileRepository(),
    imports: createImportBatchRepository(),
    resources: createResourceRepository(),
  };
}
