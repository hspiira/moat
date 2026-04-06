const DATABASE_NAME = "uganda-finance-app";
const DATABASE_VERSION = 4;

export const storeNames = {
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
} as const;

export type StoreName = (typeof storeNames)[keyof typeof storeNames];

function createStores(database: IDBDatabase) {
  for (const storeName of Object.values(storeNames)) {
    if (!database.objectStoreNames.contains(storeName)) {
      database.createObjectStore(storeName, { keyPath: "id" });
    }
  }
}

function resetStores(database: IDBDatabase) {
  const existingStoreNames = [...database.objectStoreNames];

  for (const storeName of existingStoreNames) {
    database.deleteObjectStore(storeName);
  }

  createStores(database);
}

export function openFinanceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      resetStores(request.result);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to open IndexedDB database."));
    };
  });
}
