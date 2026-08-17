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

/**
 * Receivables — money the user has lent out.
 *
 * Every loan lands in one shared pool account (a control account, seeded at
 * bootstrap) and the borrower is a `Counterparty` the transaction points at, so
 * lending to five people creates one account and five subsidiary-ledger
 * entries. A borrower who needs their own ledger can still have a dedicated
 * receivable account, and both shapes report through the same path.
 *
 * None of `debt.ts` applies: the user does not control when a borrower repays,
 * so there is no interest model, no inferred minimum payment, and no payoff
 * strategy. A due date exists only when the user states one.
 */

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
