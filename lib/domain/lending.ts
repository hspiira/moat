import {
  buildPartyPortfolio,
  buildPoolAccount,
  poolAccountIdFor,
  type PartyLedgerConfig,
  type PartyLedgerEntry,
  type PartyPortfolio,
} from "@/lib/domain/party-ledger";
import type { Account, Counterparty, Transaction } from "@/lib/types";
import { SEEDED_SLUGS } from "@/lib/domain/seeded-ids";

export const LENDING_POOL_SLUG = SEEDED_SLUGS.lendingPool;
export const LENDING_POOL_ACCOUNT_NAME = "Money lent out";

export const LENDING_LEDGER: PartyLedgerConfig = {
  poolAccountSlug: LENDING_POOL_SLUG,
  poolAccountName: LENDING_POOL_ACCOUNT_NAME,
  poolAccountType: "receivable",
  sign: 1,
  unnamedLabel: "Unnamed borrower",
  counterpartyKind: "borrower",
  cancelType: "expense",
  ownsAccount: (account) => account.type === "receivable",
};

export const lendingPoolAccountId = (userId: string) => poolAccountIdFor(LENDING_LEDGER, userId);

export type BorrowerLoans = PartyLedgerEntry;
export type LendingPortfolio = PartyPortfolio;

export function buildLendingPoolAccount(userId: string, timestamp: string): Account {
  return buildPoolAccount(LENDING_LEDGER, userId, timestamp);
}

export function getLendingPortfolio(
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
  counterparties: Counterparty[] = [],
): LendingPortfolio {
  return buildPartyPortfolio(LENDING_LEDGER, accounts, transactions, asOf, counterparties);
}
