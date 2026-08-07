import {
  buildPartyPortfolio,
  buildPoolAccount,
  type PartyLedgerConfig,
  type PartyLedgerEntry,
  type PartyPortfolio,
} from "@/lib/domain/party-ledger";
import type { Account, Counterparty, Transaction } from "@/lib/types";

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

export const BORROWING_POOL_ACCOUNT_ID = "account:money-borrowed";
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
  if (account.id === BORROWING_POOL_ACCOUNT_ID) {
    return true;
  }

  return !account.debtInterestRate && !account.debtTermMonths && !account.debtPrincipal;
}

export const BORROWING_LEDGER: PartyLedgerConfig = {
  poolAccountId: BORROWING_POOL_ACCOUNT_ID,
  poolAccountName: BORROWING_POOL_ACCOUNT_NAME,
  poolAccountType: "debt",
  sign: -1,
  unnamedLabel: "Unnamed lender",
  counterpartyKind: "lender",
  cancelType: "income",
  ownsAccount: isInformalDebt,
};

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
