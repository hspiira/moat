import { openFinanceDatabase, type StoreName } from "@/lib/repositories/indexeddb/client";
import type {
  BudgetTargetRepository,
  CategoryRepository,
  GoalRepository,
  ImportBatchRepository,
  InvestmentProfileRepository,
  Repository,
  ResourceRepository,
  TransactionRepository,
  UserProfileRepository,
} from "@/lib/repositories/types";
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

async function readAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read records from ${storeName}.`));
  });
}

async function putOne<T>(storeName: StoreName, entity: T): Promise<T> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(entity);

    request.onsuccess = () => resolve(entity);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to write record to ${storeName}.`));
  });
}

async function getOne<T>(storeName: StoreName, id: string): Promise<T | null> {
  const database = await openFinanceDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error(`Unable to read record ${id} from ${storeName}.`));
  });
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

function createUserScopedRepository<T extends { id: string; userId: string }>(
  storeName: StoreName,
): Repository<T> {
  return {
    async getById(id) {
      return getOne<T>(storeName, id);
    },
    async listByUser(userId) {
      const records = await readAll<T>(storeName);
      return records.filter((record) => record.userId === userId);
    },
    async upsert(entity) {
      return putOne(storeName, entity);
    },
    async remove(id) {
      return removeOne(storeName, id);
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
      return putOne("userProfiles", profile);
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
      const records = await repository.listByUser(userId);
      return records.filter((record) => record.occurredOn.startsWith(month));
    },
  };
}

export function createCategoryRepository(): CategoryRepository {
  const repository = createUserScopedRepository<Category>("categories");

  return {
    ...repository,
    async listDefaults(userId) {
      const categories = await repository.listByUser(userId);
      return categories.filter((category) => category.isDefault);
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
      const budgets = await repository.listByUser(userId);
      return budgets.filter((budget) => budget.month === month);
    },
  };
}

export function createInvestmentProfileRepository(): InvestmentProfileRepository {
  return {
    async getByUser(userId) {
      const records = await readAll<InvestmentProfile>("investmentProfiles");
      return records.find((record) => record.userId === userId) ?? null;
    },
    async save(profile) {
      return putOne("investmentProfiles", profile);
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

      return new Promise((resolve, reject) => {
        const transaction = database.transaction("resources", "readwrite");
        const store = transaction.objectStore("resources");
        store.clear();

        for (const resource of resources) {
          store.put(resource);
        }

        transaction.oncomplete = () => resolve(resources);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Unable to replace resources."));
      });
    },
  };
}
