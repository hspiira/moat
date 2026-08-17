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

/**
 * Informal borrowing — money the user owes people rather than institutions.
 *
 * The mirror of `lending.ts`, sharing its ledger. Kept apart from `debt.ts`
 * because an informal loan has no rate or term to amortise, and projecting one
 * would invent a schedule nobody agreed to.
 *
 * A debt account's balance is negative while money is owed, so the ledger reads
 * it with `sign: -1`. Debt forgiven is `income`, the mirror of a write-off
 * being an expense on a receivable.
 */

export const BORROWING_POOL_SLUG = SEEDED_SLUGS.borrowingPool;
export const BORROWING_POOL_ACCOUNT_NAME = "Money borrowed";

/**
 * A loan carrying a rate, a term, or a principal is formal and belongs to
 * `debt.ts`, which can model its schedule. Listing it here as well would show
 * the same money twice on the same page.
 */
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
