import { afterEach, describe, expect, it, vi } from "vitest";

function createCrudRepository() {
  return {
    getById: vi.fn().mockResolvedValue(null),
    listByUser: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockImplementation(async (entity) => entity),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

function createBundleMock() {
  return {
    userProfile: {
      get: vi.fn().mockResolvedValue({ id: "u1" }),
      save: vi.fn().mockImplementation(async (profile) => profile),
    },
    accounts: createCrudRepository(),
    transactions: {
      ...createCrudRepository(),
      listByMonth: vi.fn().mockResolvedValue([]),
    },
    captureEnvelopes: createCrudRepository(),
    captureReviewItems: createCrudRepository(),
    correctionLogs: createCrudRepository(),
    transactionRules: createCrudRepository(),
    recurringObligations: createCrudRepository(),
    monthCloses: {
      ...createCrudRepository(),
      getByPeriod: vi.fn().mockResolvedValue(null),
    },
    categories: {
      ...createCrudRepository(),
      listDefaults: vi.fn().mockResolvedValue([]),
    },
    goals: createCrudRepository(),
    budgets: {
      ...createCrudRepository(),
      listByMonth: vi.fn().mockResolvedValue([]),
    },
    investmentProfiles: {
      getByUser: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (profile) => profile),
    },
    imports: createCrudRepository(),
    resources: {
      list: vi.fn().mockResolvedValue([]),
      replaceAll: vi.fn().mockImplementation(async (resources) => resources),
    },
    syncProfiles: {
      getByUser: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (profile) => profile),
    },
    syncOutbox: {
      ...createCrudRepository(),
      listPendingByUser: vi.fn().mockResolvedValue([]),
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/lib/native/storage-bridge");
  vi.doUnmock("@/lib/repositories/indexeddb");
  vi.doUnmock("@/lib/repositories/sqlite");
});

describe("repository instance", () => {
  it("uses sqlite when the native storage bridge is available", async () => {
    const sqliteBundle = createBundleMock();
    const indexedDbBundle = createBundleMock();

    vi.doMock("@/lib/native/storage-bridge", () => ({
      hasNativeStorageBridge: () => true,
    }));
    vi.doMock("@/lib/repositories/sqlite", () => ({
      createSqliteRepositories: () => sqliteBundle,
    }));
    vi.doMock("@/lib/repositories/indexeddb", () => ({
      createIndexedDbRepositories: () => indexedDbBundle,
    }));

    const module = await import("@/lib/repositories/instance");
    await module.repositories.userProfile.get();

    expect(sqliteBundle.userProfile.get).toHaveBeenCalledTimes(1);
    expect(indexedDbBundle.userProfile.get).not.toHaveBeenCalled();
    expect(module.getRepositoryBackend()).toBe("sqlite");
    expect(module.getRepositoryBackendWarning()).toBeNull();
  });

  it("falls back to indexeddb when sqlite initialization fails", async () => {
    const indexedDbBundle = createBundleMock();

    vi.doMock("@/lib/native/storage-bridge", () => ({
      hasNativeStorageBridge: () => true,
    }));
    vi.doMock("@/lib/repositories/sqlite", () => ({
      createSqliteRepositories: () => {
        throw new Error("bridge init failed");
      },
    }));
    vi.doMock("@/lib/repositories/indexeddb", () => ({
      createIndexedDbRepositories: () => indexedDbBundle,
    }));

    const module = await import("@/lib/repositories/instance");
    await module.repositories.userProfile.get();

    expect(indexedDbBundle.userProfile.get).toHaveBeenCalledTimes(1);
    expect(module.getRepositoryBackend()).toBe("indexeddb");
    expect(module.getRepositoryBackendWarning()).toContain("bridge init failed");
  });
});
