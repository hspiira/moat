const DATABASE_NAME = "moat-db";
const DATABASE_VERSION = 7;

export const storeNames = {
  meta: "meta",
  userProfiles: "userProfiles",
  accounts: "accounts",
  transactions: "transactions",
  captureEnvelopes: "captureEnvelopes",
  captureReviewItems: "captureReviewItems",
  correctionLogs: "correctionLogs",
  transactionRules: "transactionRules",
  recurringObligations: "recurringObligations",
  monthCloses: "monthCloses",
  categories: "categories",
  goals: "goals",
  budgets: "budgets",
  investmentProfiles: "investmentProfiles",
  imports: "imports",
  resources: "resources",
  syncProfiles: "syncProfiles",
  syncOutbox: "syncOutbox",
} as const;

export type StoreName = (typeof storeNames)[keyof typeof storeNames];

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

function runMigrations(database: IDBDatabase, transaction: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) {
    createBaseStores(database);
  }

  if (oldVersion < 4) {
    ensureStore(database, "captureEnvelopes");
    ensureStore(database, "captureReviewItems");
    ensureStore(database, "correctionLogs");
    ensureStore(database, "transactionRules");
    ensureStore(database, "recurringObligations");
    ensureStore(database, "monthCloses");
  }

  if (oldVersion < 5) {
    for (const storeName of Object.values(storeNames)) {
      ensureStore(database, storeName);
    }
  }

  if (oldVersion < 6) {
    ensureStore(database, "syncProfiles");
    ensureStore(database, "syncOutbox");
  }

  if (oldVersion < 7) {
    for (const storeName of Object.values(storeNames)) {
      ensureStore(database, storeName);
    }
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

export function getIndexedDbMigrationVersions(oldVersion: number): number[] {
  const versions = [1, 4, 5, 6, 7];
  return versions.filter((version) => oldVersion < version);
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
