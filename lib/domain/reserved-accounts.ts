import { BORROWING_LEDGER } from "@/lib/domain/borrowing";
import { LENDING_LEDGER } from "@/lib/domain/lending";
import {
  isPoolAccount,
  poolAccountIdFor,
  type PartyLedgerConfig,
} from "@/lib/domain/party-ledger";
import type { Account, CounterpartyKind } from "@/lib/types";

export const PARTY_LEDGERS: PartyLedgerConfig[] = [LENDING_LEDGER, BORROWING_LEDGER];

export function isReservedAccount(account: Account): boolean {
  return PARTY_LEDGERS.some((ledger) => isPoolAccount(ledger, account));
}

export function isReservedAccountName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return PARTY_LEDGERS.some(
    (ledger) => ledger.poolAccountName.toLowerCase() === normalized,
  );
}

export function reservedLedgerForAccount(account: Account): PartyLedgerConfig | undefined {
  return PARTY_LEDGERS.find((ledger) => isPoolAccount(ledger, account));
}

export function ledgerForAccountType(
  accountType: PartyLedgerConfig["poolAccountType"],
): PartyLedgerConfig | undefined {
  return PARTY_LEDGERS.find((ledger) => ledger.poolAccountType === accountType);
}

export function poolCounterpartyKinds(userId: string): Map<string, CounterpartyKind> {
  return new Map(
    PARTY_LEDGERS.map((ledger) => [
      poolAccountIdFor(ledger, userId),
      ledger.counterpartyKind,
    ]),
  );
}
