import {
  buildPartyPortfolio,
  buildPoolAccount,
  poolAccountIdFor,
  type PartyLedgerConfig,
  type PartyLedgerEntry,
  type PartyPortfolio,
} from "@/lib/domain/party-ledger";
import type { Account, Counterparty, Transaction } from "@/lib/types";
import { deriveSeededId } from "@/lib/ids";
import { SEEDED_SLUGS } from "@/lib/domain/seeded-ids";

export const BORROWING_POOL_SLUG = SEEDED_SLUGS.borrowingPool;
export const BORROWING_POOL_ACCOUNT_NAME = "Money borrowed";

export function isInformalDebt(account: Account): boolean {
  if (account.type !== "debt") {
    return false;
  }
  if (account.id === deriveSeededId(account.userId, BORROWING_POOL_SLUG)) {
    return true;
  }

  return !account.debtInterestRate && !account.debtTermMonths && !account.debtPrincipal;
}

export const BORROWING_LEDGER: PartyLedgerConfig = {
  poolAccountSlug: BORROWING_POOL_SLUG,
  poolAccountName: BORROWING_POOL_ACCOUNT_NAME,
  poolAccountType: "debt",
  sign: -1,
  unnamedLabel: "Unnamed lender",
  counterpartyKind: "lender",
  cancelType: "income",
  ownsAccount: isInformalDebt,
};

export const borrowingPoolAccountId = (userId: string) =>
  poolAccountIdFor(BORROWING_LEDGER, userId);

export type LenderLoans = PartyLedgerEntry;
export type BorrowingPortfolio = PartyPortfolio;

export function buildBorrowingPoolAccount(userId: string, timestamp: string): Account {
  return buildPoolAccount(BORROWING_LEDGER, userId, timestamp);
}

export function getBorrowingPortfolio(
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
  counterparties: Counterparty[] = [],
): BorrowingPortfolio {
  return buildPartyPortfolio(BORROWING_LEDGER, accounts, transactions, asOf, counterparties);
}
