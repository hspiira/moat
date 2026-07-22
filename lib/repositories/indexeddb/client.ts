import { storeNames, type StoreName } from "@/lib/repositories/store-names";

// Re-exported so existing IndexedDB-side import sites keep working; the
// canonical definition lives in the backend-neutral store-names module.
export { storeNames };
export type { StoreName };

const DATABASE_NAME = "moat-db";
const DATABASE_VERSION = 8;

// Single source of truth for the additive schema migrations. Both the
// upgrade path (runMigrations) and the reporting helper below derive from it,
// so a new version is added in exactly one place.
const MIGRATION_VERSIONS = [1, 4, 5, 6, 7, 8] as const;

type MetaRecord = {
  id: "schema";
  schemaVersion: number;
  updatedAt: string;
};

type StoreIndexDefinition = {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
};

const USER_ID_INDEX = "byUserId";
const USER_ID_OCCURRED_ON_INDEX = "byUserIdOccurredOn";
const USER_ID_MONTH_INDEX = "byUserIdMonth";
const USER_ID_PERIOD_INDEX = "byUserIdPeriod";
const USER_ID_IS_DEFAULT_INDEX = "byUserIdIsDefault";
const USER_ID_STATUS_INDEX = "byUserIdStatus";

const storeIndexes: Partial<Record<StoreName, StoreIndexDefinition[]>> = {
  accounts: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  transactions: [
    { name: USER_ID_INDEX, keyPath: "userId" },
    { name: USER_ID_OCCURRED_ON_INDEX, keyPath: ["userId", "occurredOn"] },
  ],
  captureEnvelopes: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  captureReviewItems: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  correctionLogs: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  transactionRules: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  recurringObligations: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  monthCloses: [
    { name: USER_ID_INDEX, keyPath: "userId" },
    { name: USER_ID_PERIOD_INDEX, keyPath: ["userId", "period"] },
  ],
  categories: [
    { name: USER_ID_INDEX, keyPath: "userId" },
    { name: USER_ID_IS_DEFAULT_INDEX, keyPath: ["userId", "isDefault"] },
  ],
  goals: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  budgets: [
    { name: USER_ID_INDEX, keyPath: "userId" },
    { name: USER_ID_MONTH_INDEX, keyPath: ["userId", "month"] },
  ],
  investmentProfiles: [{ name: USER_ID_INDEX, keyPath: "userId", options: { unique: true } }],
  imports: [{ name: USER_ID_INDEX, keyPath: "userId" }],
  syncProfiles: [{ name: USER_ID_INDEX, keyPath: "userId", options: { unique: true } }],
  syncOutbox: [
    { name: USER_ID_INDEX, keyPath: "userId" },
    { name: USER_ID_STATUS_INDEX, keyPath: ["userId", "status"] },
  ],
};

function ensureStore(database: IDBDatabase, storeName: StoreName) {
  if (!database.objectStoreNames.contains(storeName)) {
    database.createObjectStore(storeName, { keyPath: "id" });
  }
}

function ensureIndexes(
  transaction: IDBTransaction,
  storeName: StoreName,
  indexes: StoreIndexDefinition[] = [],
) {
  if (!transaction.db.objectStoreNames.contains(storeName)) {
    return;
  }

  const store = transaction.objectStore(storeName);
  indexes.forEach((index) => {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options);
    }
  });
}

function createBaseStores(database: IDBDatabase) {
  ensureStore(database, "meta");
  ensureStore(database, "userProfiles");
  ensureStore(database, "accounts");
  ensureStore(database, "transactions");
  ensureStore(database, "categories");
  ensureStore(database, "goals");
  ensureStore(database, "budgets");
  ensureStore(database, "investmentProfiles");
  ensureStore(database, "imports");
  ensureStore(database, "resources");
  ensureStore(database, "syncProfiles");
  ensureStore(database, "syncOutbox");
}

function addAllKnownIndexes(transaction: IDBTransaction) {
  Object.entries(storeIndexes).forEach(([storeName, indexes]) => {
    ensureIndexes(transaction, storeName as StoreName, indexes);
  });
}

// Per-version schema steps, keyed by the versions in MIGRATION_VERSIONS.
// Versions without a dedicated step still benefit from the catch-all store /
// index reconciliation that runs after every upgrade.
const migrationSteps: Partial<Record<number, (database: IDBDatabase) => void>> = {
  1: (database) => createBaseStores(database),
  4: (database) => {
    ensureStore(database, "captureEnvelopes");
    ensureStore(database, "captureReviewItems");
    ensureStore(database, "correctionLogs");
    ensureStore(database, "transactionRules");
    ensureStore(database, "recurringObligations");
    ensureStore(database, "monthCloses");
  },
  6: (database) => {
    ensureStore(database, "syncProfiles");
    ensureStore(database, "syncOutbox");
  },
};

function runMigrations(database: IDBDatabase, transaction: IDBTransaction, oldVersion: number) {
  for (const version of MIGRATION_VERSIONS) {
    if (oldVersion < version) {
      migrationSteps[version]?.(database);
    }
  }

  for (const storeName of Object.values(storeNames)) {
    ensureStore(database, storeName);
  }

  addAllKnownIndexes(transaction);
}

function persistSchemaMeta(database: IDBDatabase) {
  if (!database.objectStoreNames.contains(storeNames.meta)) {
    return;
  }

  const transaction = database.transaction(storeNames.meta, "readwrite");
  const store = transaction.objectStore(storeNames.meta);
  const record: MetaRecord = {
    id: "schema",
    schemaVersion: DATABASE_VERSION,
    updatedAt: new Date().toISOString(),
  };
  store.put(record);
}

export function openFinanceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) {
        reject(new Error("IndexedDB upgrade transaction is unavailable."));
        return;
      }

      runMigrations(request.result, transaction, event.oldVersion);
    };

    request.onblocked = () => {
      reject(new Error("IndexedDB upgrade is blocked by another open app session."));
    };

    request.onsuccess = () => {
      const database = request.result;
      persistSchemaMeta(database);
      resolve(database);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to open IndexedDB database."));
    };
  });
}

export function getIndexedDbStoreIndexes(storeName: StoreName): string[] {
  return (storeIndexes[storeName] ?? []).map((index) => index.name);
}

/**
 * Resolve the index whose key path matches `keyPath` exactly, so the adapter
 * can translate a semantic query (by user, by user+field) into the concrete
 * index name without hard-coding the schema a second time.
 */
export function getIndexedDbIndexName(storeName: StoreName, keyPath: string[]): string {
  const match = (storeIndexes[storeName] ?? []).find((index) => {
    const indexPath = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath];
    return (
      indexPath.length === keyPath.length &&
      indexPath.every((segment, position) => segment === keyPath[position])
    );
  });

  if (!match) {
    throw new Error(`No IndexedDB index for ${storeName} on [${keyPath.join(", ")}].`);
  }

  return match.name;
}

export function getIndexedDbMigrationVersions(oldVersion: number): number[] {
  return MIGRATION_VERSIONS.filter((version) => oldVersion < version);
}

export {
  DATABASE_NAME,
  DATABASE_VERSION,
  USER_ID_INDEX,
  USER_ID_IS_DEFAULT_INDEX,
  USER_ID_MONTH_INDEX,
  USER_ID_OCCURRED_ON_INDEX,
  USER_ID_PERIOD_INDEX,
  USER_ID_STATUS_INDEX,
};
