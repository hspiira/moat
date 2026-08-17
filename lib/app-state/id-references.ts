/**
 * Every field that holds another record's id.
 *
 * The id migration rewrites records against this map, so a field missing here
 * keeps an id that no longer exists and silently breaks the link. Nothing
 * derives it from the types at runtime, so adding a reference field to
 * lib/types.ts means adding it here too — id-migration.test.ts checks the map
 * against a list of every `*Id` field in the type file to catch that.
 *
 * `path` is dotted for references nested inside an object, which capture
 * snapshots are.
 */

import type { StoreName } from "@/lib/repositories/store-names";

export type IdReference = {
  /** Dotted path to the field, relative to the record. */
  path: string;
  /** The store the id points into. */
  target: StoreName;
};

/**
 * Capture snapshots embed an account and a category, and appear on both review
 * items and correction logs.
 */
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

/**
 * `transferGroupId` groups the legs of one transfer. It is not a record id, so
 * it is remapped on its own: every leg sharing a group must come out sharing
 * the new one.
 */
export const GROUP_ID_FIELD = "transferGroupId";
