/**
 * Backend-neutral catalogue of storage collections. Both the IndexedDB and
 * SQLite backends key their records by these names, so it lives here rather
 * than inside either backend to keep them decoupled.
 */
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
