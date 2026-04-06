const DATABASE_NAME = "uganda-finance-app";
const DATABASE_VERSION = 6;

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

function ensureStore(database: IDBDatabase, storeName: StoreName) {
  if (!database.objectStoreNames.contains(storeName)) {
    database.createObjectStore(storeName, { keyPath: "id" });
  }
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

function runMigrations(database: IDBDatabase, oldVersion: number) {
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
      runMigrations(request.result, event.oldVersion);
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
