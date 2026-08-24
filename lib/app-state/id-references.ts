import type { StoreName } from "@/lib/repositories/store-names";

export type IdReference = {
  path: string;
  target: StoreName;
};

const snapshotReferences = (prefix: string): IdReference[] => [
  { path: `${prefix}.accountId`, target: "accounts" },
  { path: `${prefix}.categoryId`, target: "categories" },
];

export const idReferences: Partial<Record<StoreName, IdReference[]>> = {
  accounts: [],
  userProfiles: [],
  categories: [],
  counterparties: [],
  investmentProfiles: [],
  imports: [],
  captureEnvelopes: [],
  monthCloses: [],
  syncProfiles: [],

  transactions: [
    { path: "accountId", target: "accounts" },
    { path: "categoryId", target: "categories" },
    { path: "captureEnvelopeId", target: "captureEnvelopes" },
    { path: "captureReviewItemId", target: "captureReviewItems" },
    { path: "matchedRuleId", target: "transactionRules" },
    { path: "feeParentId", target: "transactions" },
    { path: "counterpartyId", target: "counterparties" },
    { path: "importBatchId", target: "imports" },
    { path: "projectId", target: "projects" },
  ],

  items: [{ path: "defaultCategoryId", target: "categories" }],

  plannedPurchases: [
    { path: "itemId", target: "items" },
    { path: "linkedTransactionId", target: "transactions" },
    { path: "linkedLineItemId", target: "transactionLineItems" },
  ],

  transactionLineItems: [
    { path: "transactionId", target: "transactions" },
    { path: "itemId", target: "items" },
    { path: "categoryId", target: "categories" },
    { path: "plannedPurchaseId", target: "plannedPurchases" },
  ],

  goals: [{ path: "linkedAccountId", target: "accounts" }],

  budgets: [
    { path: "categoryId", target: "categories" },
    { path: "incomeTransactionId", target: "transactions" },
  ],

  recurringObligations: [
    { path: "categoryId", target: "categories" },
    { path: "linkedAccountId", target: "accounts" },
  ],

  transactionRules: [
    { path: "categoryId", target: "categories" },
    { path: "accountId", target: "accounts" },
    { path: "effectCategoryId", target: "categories" },
    { path: "effectAccountId", target: "accounts" },
  ],

  captureReviewItems: [
    { path: "envelopeId", target: "captureEnvelopes" },
    { path: "accountId", target: "accounts" },
    { path: "destinationAccountId", target: "accounts" },
    { path: "categoryId", target: "categories" },
    { path: "duplicateTransactionId", target: "transactions" },
    { path: "duplicateCaptureReviewItemId", target: "captureReviewItems" },
    { path: "approvedTransactionId", target: "transactions" },
    ...snapshotReferences("originalSnapshot"),
  ],

  correctionLogs: [
    { path: "reviewItemId", target: "captureReviewItems" },
    { path: "envelopeId", target: "captureEnvelopes" },
    ...snapshotReferences("originalSnapshot"),
    ...snapshotReferences("approvedSnapshot"),
  ],
};

export const GROUP_ID_FIELD = "transferGroupId";
