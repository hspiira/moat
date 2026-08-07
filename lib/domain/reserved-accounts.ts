import { BORROWING_LEDGER } from "@/lib/domain/borrowing";
import { LENDING_LEDGER } from "@/lib/domain/lending";
import type { PartyLedgerConfig } from "@/lib/domain/party-ledger";

/**
 * The pools every user gets without asking. They are reserved because they are
 * created for everyone: a second account by the same name is what caused
 * duplicates when the pools were still made on demand.
 */

export const PARTY_LEDGERS: PartyLedgerConfig[] = [LENDING_LEDGER, BORROWING_LEDGER];

export function isReservedAccountId(accountId: string): boolean {
  return PARTY_LEDGERS.some((ledger) => ledger.poolAccountId === accountId);
}

/** Compared case- and whitespace-insensitively, since that is the confusion. */
export function isReservedAccountName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return PARTY_LEDGERS.some(
    (ledger) => ledger.poolAccountName.toLowerCase() === normalized,
  );
}

export function reservedLedgerForAccount(accountId: string): PartyLedgerConfig | undefined {
  return PARTY_LEDGERS.find((ledger) => ledger.poolAccountId === accountId);
}

export function ledgerForAccountType(
  accountType: PartyLedgerConfig["poolAccountType"],
): PartyLedgerConfig | undefined {
  return PARTY_LEDGERS.find((ledger) => ledger.poolAccountType === accountType);
}
