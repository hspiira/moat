/**
 * Slugs for records the app seeds for every user.
 *
 * A seeded record's id is `deriveSeededId(userId, slug)`, so two devices
 * belonging to the same user compute the same id and sync merges them rather
 * than creating a second copy of every default.
 *
 * These strings are part of the data format. Changing one repoints the record
 * it names, which orphans whatever is already stored under the old id.
 */

import { deriveSeededId } from "@/lib/ids";

export const SEEDED_SLUGS = {
  lendingPool: "account:money-lent-out",
  borrowingPool: "account:money-borrowed",
  fees: "category:fees-charges",
  writeOff: "category:money-written-off",
  loanInterest: "category:loan-interest",
  debtRepayment: "category:debt-repayment",
  transfers: "category:transfers",
  investmentProfile: "investment-profile",
  syncProfile: "sync-profile",
} as const;

export type SeededSlug = (typeof SEEDED_SLUGS)[keyof typeof SEEDED_SLUGS];

/** The slug a seeded category is derived from, given its display name. */
export function categorySlug(name: string): string {
  return `category:${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
}

export function seededCategoryId(userId: string, name: string): string {
  return deriveSeededId(userId, categorySlug(name));
}

export const feesCategoryId = (userId: string) => deriveSeededId(userId, SEEDED_SLUGS.fees);
export const writeOffCategoryId = (userId: string) => deriveSeededId(userId, SEEDED_SLUGS.writeOff);
export const loanInterestCategoryId = (userId: string) =>
  deriveSeededId(userId, SEEDED_SLUGS.loanInterest);
export const debtRepaymentCategoryId = (userId: string) =>
  deriveSeededId(userId, SEEDED_SLUGS.debtRepayment);
export const transfersCategoryId = (userId: string) =>
  deriveSeededId(userId, SEEDED_SLUGS.transfers);

export const investmentProfileId = (userId: string) =>
  deriveSeededId(userId, SEEDED_SLUGS.investmentProfile);
export const syncProfileId = (userId: string) => deriveSeededId(userId, SEEDED_SLUGS.syncProfile);
