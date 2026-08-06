import {
  BORROWING_POOL_ACCOUNT_ID,
  BORROWING_POOL_ACCOUNT_NAME,
  buildBorrowingPoolAccount,
} from "@/lib/domain/borrowing";
import {
  LENDING_POOL_ACCOUNT_ID,
  LENDING_POOL_ACCOUNT_NAME,
  buildLendingPoolAccount,
} from "@/lib/domain/lending";
import type { Account } from "@/lib/types";

export const RESERVED_ACCOUNT_IDS = [
  LENDING_POOL_ACCOUNT_ID,
  BORROWING_POOL_ACCOUNT_ID,
] as const;

export const RESERVED_ACCOUNT_NAMES = [
  LENDING_POOL_ACCOUNT_NAME,
  BORROWING_POOL_ACCOUNT_NAME,
] as const;

export function isReservedAccountId(accountId: string): boolean {
  return RESERVED_ACCOUNT_IDS.some((reserved) => reserved === accountId);
}

export function isReservedAccountName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return RESERVED_ACCOUNT_NAMES.some((reserved) => reserved.toLowerCase() === normalized);
}

export function buildDefaultAccounts(userId: string, timestamp: string): Account[] {
  return [
    buildLendingPoolAccount(userId, timestamp),
    buildBorrowingPoolAccount(userId, timestamp),
  ];
}

/**
 * Mirrors `reconcileDefaultCategories` for devices set up before the pools were
 * seeded. An archived pool is left alone rather than resurrected, which is why
 * the pools can be archived but not deleted.
 */
export function reconcileDefaultAccounts(
  stored: Account[],
  userId: string,
  timestamp: string,
): Account[] {
  const existingIds = new Set(stored.map((account) => account.id));

  return buildDefaultAccounts(userId, timestamp).filter(
    (account) => !existingIds.has(account.id),
  );
}
