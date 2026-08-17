import { buildPoolAccount, poolAccountIdFor } from "@/lib/domain/party-ledger";
import { PARTY_LEDGERS } from "@/lib/domain/reserved-accounts";
import type { Account } from "@/lib/types";

export function buildDefaultAccounts(userId: string, timestamp: string): Account[] {
  return PARTY_LEDGERS.map((ledger) => buildPoolAccount(ledger, userId, timestamp));
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

  // Matches the derived id and the slug it used to be stored under, so a
  // device set up before ids were derived does not gain a second pool.
  return PARTY_LEDGERS.filter(
    (ledger) =>
      !existingIds.has(poolAccountIdFor(ledger, userId)) &&
      !existingIds.has(ledger.poolAccountSlug),
  ).map((ledger) => buildPoolAccount(ledger, userId, timestamp));
}
