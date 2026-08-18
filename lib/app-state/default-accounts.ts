import { buildPoolAccount, poolAccountIdFor } from "@/lib/domain/party-ledger";
import { PARTY_LEDGERS } from "@/lib/domain/reserved-accounts";
import type { Account } from "@/lib/types";

export function buildDefaultAccounts(userId: string, timestamp: string): Account[] {
  return PARTY_LEDGERS.map((ledger) => buildPoolAccount(ledger, userId, timestamp));
}

export function reconcileDefaultAccounts(
  stored: Account[],
  userId: string,
  timestamp: string,
): Account[] {
  const existingIds = new Set(stored.map((account) => account.id));

  return PARTY_LEDGERS.filter(
    (ledger) =>
      !existingIds.has(poolAccountIdFor(ledger, userId)) &&
      !existingIds.has(ledger.poolAccountSlug),
  ).map((ledger) => buildPoolAccount(ledger, userId, timestamp));
}
