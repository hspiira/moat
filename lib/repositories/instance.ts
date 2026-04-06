import { hasNativeStorageBridge } from "@/lib/native/storage-bridge";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { createSqliteRepositories } from "@/lib/repositories/sqlite";
import type { Repository, RepositoryBundle } from "@/lib/repositories/types";

export type RepositoryBackend = "indexeddb" | "sqlite";

type BackendWarningListener = (warning: string | null) => void;

let bundlePromise: Promise<RepositoryBundle> | null = null;
let resolvedBackend: RepositoryBackend | null = null;
let backendWarning: string | null = null;
const warningListeners = new Set<BackendWarningListener>();

function publishWarning(warning: string | null) {
  backendWarning = warning;
  warningListeners.forEach((listener) => listener(warning));
}

async function resolveRepositoryBundle(): Promise<RepositoryBundle> {
  if (hasNativeStorageBridge()) {
    try {
      const bundle = createSqliteRepositories();
      resolvedBackend = "sqlite";
      publishWarning(null);
      return bundle;
    } catch (error) {
      resolvedBackend = "indexeddb";
      publishWarning(
        error instanceof Error
          ? `Native storage unavailable, using IndexedDB instead: ${error.message}`
          : "Native storage unavailable, using IndexedDB instead.",
      );
      return createIndexedDbRepositories();
    }
  }

  resolvedBackend = "indexeddb";
  publishWarning(null);
  return createIndexedDbRepositories();
}

function getBundlePromise() {
  bundlePromise ??= resolveRepositoryBundle();
  return bundlePromise;
}

function createCrudRepositoryProxy<T extends { id: string }>(
  resolve: () => Promise<Repository<T>>,
): Repository<T> {
  return {
    async getById(id: string) {
      const repository = await resolve();
      return repository.getById(id);
    },
    async listByUser(userId: string) {
      const repository = await resolve();
      return repository.listByUser(userId);
    },
    async upsert(entity: T) {
      const repository = await resolve();
      return repository.upsert(entity);
    },
    async remove(id: string) {
      const repository = await resolve();
      return repository.remove(id);
    },
  };
}

function createBundleProxy(): RepositoryBundle {
  return {
    userProfile: {
      async get() {
        const bundle = await getBundlePromise();
        return bundle.userProfile.get();
      },
      async save(profile) {
        const bundle = await getBundlePromise();
        return bundle.userProfile.save(profile);
      },
    },
    accounts: createCrudRepositoryProxy(async () => (await getBundlePromise()).accounts),
    transactions: {
      ...createCrudRepositoryProxy(async () => (await getBundlePromise()).transactions),
      async listByMonth(userId, month) {
        const bundle = await getBundlePromise();
        return bundle.transactions.listByMonth(userId, month);
      },
    },
    captureEnvelopes: createCrudRepositoryProxy(async () => (await getBundlePromise()).captureEnvelopes),
    captureReviewItems: createCrudRepositoryProxy(
      async () => (await getBundlePromise()).captureReviewItems,
    ),
    correctionLogs: createCrudRepositoryProxy(async () => (await getBundlePromise()).correctionLogs),
    transactionRules: createCrudRepositoryProxy(
      async () => (await getBundlePromise()).transactionRules,
    ),
    recurringObligations: createCrudRepositoryProxy(
      async () => (await getBundlePromise()).recurringObligations,
    ),
    monthCloses: {
      ...createCrudRepositoryProxy(async () => (await getBundlePromise()).monthCloses),
      async getByPeriod(userId, period) {
        const bundle = await getBundlePromise();
        return bundle.monthCloses.getByPeriod(userId, period);
      },
    },
    categories: {
      ...createCrudRepositoryProxy(async () => (await getBundlePromise()).categories),
      async listDefaults(userId) {
        const bundle = await getBundlePromise();
        return bundle.categories.listDefaults(userId);
      },
    },
    goals: createCrudRepositoryProxy(async () => (await getBundlePromise()).goals),
    budgets: {
      ...createCrudRepositoryProxy(async () => (await getBundlePromise()).budgets),
      async listByMonth(userId, month) {
        const bundle = await getBundlePromise();
        return bundle.budgets.listByMonth(userId, month);
      },
    },
    investmentProfiles: {
      async getByUser(userId) {
        const bundle = await getBundlePromise();
        return bundle.investmentProfiles.getByUser(userId);
      },
      async save(profile) {
        const bundle = await getBundlePromise();
        return bundle.investmentProfiles.save(profile);
      },
    },
    imports: createCrudRepositoryProxy(async () => (await getBundlePromise()).imports),
    resources: {
      async list() {
        const bundle = await getBundlePromise();
        return bundle.resources.list();
      },
      async replaceAll(resources) {
        const bundle = await getBundlePromise();
        return bundle.resources.replaceAll(resources);
      },
    },
    syncProfiles: {
      async getByUser(userId) {
        const bundle = await getBundlePromise();
        return bundle.syncProfiles.getByUser(userId);
      },
      async save(profile) {
        const bundle = await getBundlePromise();
        return bundle.syncProfiles.save(profile);
      },
    },
    syncOutbox: {
      ...createCrudRepositoryProxy(async () => (await getBundlePromise()).syncOutbox),
      async listPendingByUser(userId) {
        const bundle = await getBundlePromise();
        return bundle.syncOutbox.listPendingByUser(userId);
      },
    },
  };
}

export const repositories: RepositoryBundle = createBundleProxy();

export function getRepositoryBackend(): RepositoryBackend | null {
  return resolvedBackend;
}

export function getRepositoryBackendWarning(): string | null {
  return backendWarning;
}

export function subscribeToRepositoryBackendWarning(listener: BackendWarningListener) {
  warningListeners.add(listener);
  return () => {
    warningListeners.delete(listener);
  };
}

export function resetRepositorySingletonForTests() {
  bundlePromise = null;
  resolvedBackend = null;
  publishWarning(null);
}
