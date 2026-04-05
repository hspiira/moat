import {
  createAccountRepository,
  createBudgetTargetRepository,
  createCategoryRepository,
  createGoalRepository,
  createImportBatchRepository,
  createInvestmentProfileRepository,
  createResourceRepository,
  createTransactionRepository,
  createUserProfileRepository,
} from "@/lib/repositories/indexeddb/repository";
import type { RepositoryBundle } from "@/lib/repositories/types";

export function createIndexedDbRepositories(): RepositoryBundle {
  return {
    userProfile: createUserProfileRepository(),
    accounts: createAccountRepository(),
    transactions: createTransactionRepository(),
    categories: createCategoryRepository(),
    goals: createGoalRepository(),
    budgets: createBudgetTargetRepository(),
    investmentProfiles: createInvestmentProfileRepository(),
    imports: createImportBatchRepository(),
    resources: createResourceRepository(),
  };
}
