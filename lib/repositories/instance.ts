import { hasNativeStorageBridge } from "@/lib/native/storage-bridge";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { createSqliteRepositories } from "@/lib/repositories/sqlite";
import type { RepositoryBundle } from "@/lib/repositories/types";

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

/**
 * Build a lazy stand-in for a repository whose real implementation isn't
 * resolved until the first call. Each named method resolves the backing
 * repository, then forwards its arguments and return value unchanged.
 */
function lazyDelegate<T extends object>(resolve: () => Promise<T>, methods: Array<keyof T>): T {
  const proxy = {} as Record<keyof T, unknown>;
  for (const method of methods) {
    proxy[method] = async (...args: unknown[]) => {
      const target = (await resolve()) as Record<keyof T, (...args: unknown[]) => unknown>;
      return target[method](...args);
    };
  }
  return proxy as T;
}

const crudMethods = ["getById", "listByUser", "upsert", "remove"] as const;

function lazyRepository<K extends keyof RepositoryBundle>(
  key: K,
  extraMethods: Array<keyof RepositoryBundle[K]> = [],
): RepositoryBundle[K] {
  const methods = [...crudMethods, ...extraMethods] as unknown as Array<keyof RepositoryBundle[K]>;
  return lazyDelegate<RepositoryBundle[K]>(async () => (await getBundlePromise())[key], methods);
}

function createBundleProxy(): RepositoryBundle {
  return {
    userProfile: lazyDelegate(async () => (await getBundlePromise()).userProfile, ["get", "save"]),
    accounts: lazyRepository("accounts"),
    transactions: lazyRepository("transactions", ["listByMonth"]),
    captureEnvelopes: lazyRepository("captureEnvelopes"),
    captureReviewItems: lazyRepository("captureReviewItems"),
    correctionLogs: lazyRepository("correctionLogs"),
    transactionRules: lazyRepository("transactionRules"),
    recurringObligations: lazyRepository("recurringObligations"),
    monthCloses: lazyRepository("monthCloses", ["getByPeriod"]),
    categories: lazyRepository("categories", ["listDefaults"]),
    goals: lazyRepository("goals"),
    budgets: lazyRepository("budgets", ["listByMonth"]),
    investmentProfiles: lazyDelegate(
      async () => (await getBundlePromise()).investmentProfiles,
      ["getByUser", "save"],
    ),
    imports: lazyRepository("imports"),
    resources: lazyDelegate(async () => (await getBundlePromise()).resources, ["list", "replaceAll"]),
    syncProfiles: lazyDelegate(
      async () => (await getBundlePromise()).syncProfiles,
      ["getByUser", "save"],
    ),
    syncOutbox: lazyRepository("syncOutbox", ["listPendingByUser"]),
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
