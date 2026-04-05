import type {
  Account,
  BudgetTarget,
  Category,
  Goal,
  ImportBatch,
  InvestmentProfile,
  ResourceLink,
  Transaction,
  UserProfile,
} from "@/lib/types";

export interface Repository<T extends { id: string }> {
  getById(id: string): Promise<T | null>;
  listByUser(userId: string): Promise<T[]>;
  upsert(entity: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface UserProfileRepository {
  get(): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<UserProfile>;
}

export type AccountRepository = Repository<Account>;

export interface TransactionRepository extends Repository<Transaction> {
  listByMonth(userId: string, month: string): Promise<Transaction[]>;
}

export interface CategoryRepository extends Repository<Category> {
  listDefaults(userId: string): Promise<Category[]>;
}

export type GoalRepository = Repository<Goal>;

export interface BudgetTargetRepository extends Repository<BudgetTarget> {
  listByMonth(userId: string, month: string): Promise<BudgetTarget[]>;
}

export interface InvestmentProfileRepository {
  getByUser(userId: string): Promise<InvestmentProfile | null>;
  save(profile: InvestmentProfile): Promise<InvestmentProfile>;
}

export type ImportBatchRepository = Repository<ImportBatch>;

export interface ResourceRepository {
  list(): Promise<ResourceLink[]>;
  replaceAll(resources: ResourceLink[]): Promise<ResourceLink[]>;
}

export interface RepositoryBundle {
  userProfile: UserProfileRepository;
  accounts: AccountRepository;
  transactions: TransactionRepository;
  categories: CategoryRepository;
  goals: GoalRepository;
  budgets: BudgetTargetRepository;
  investmentProfiles: InvestmentProfileRepository;
  imports: ImportBatchRepository;
  resources: ResourceRepository;
}
