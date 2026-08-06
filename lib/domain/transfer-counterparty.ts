import { BORROWING_POOL_ACCOUNT_ID, isInformalDebt } from "@/lib/domain/borrowing";
import { LENDING_POOL_ACCOUNT_ID } from "@/lib/domain/lending";
import type { Account } from "@/lib/types";

/**
 * Both legs are inspected, not just the destination. A repayment puts the loan
 * account on the source side, so looking only at the destination collected no
 * name and dropped the record into the pool's unnamed bucket.
 */

export type TransferDirection = "lend" | "collect" | "borrow" | "repay";

export type TransferCounterparty = {
  direction: TransferDirection;
  label: string;
  placeholder: string;
  /** Pools group on the payee; a dedicated account carries the name already. */
  requiresPayee: boolean;
  showExpectedDate: boolean;
};

function isLoanLeg(account: Account | undefined): boolean {
  return account !== undefined && (account.type === "receivable" || isInformalDebt(account));
}

function isPool(account: Account | undefined): boolean {
  return (
    account !== undefined &&
    (account.id === LENDING_POOL_ACCOUNT_ID || account.id === BORROWING_POOL_ACCOUNT_ID)
  );
}

export function describeTransferCounterparty(
  accounts: Account[],
  sourceAccountId: string,
  destinationAccountId: string,
): TransferCounterparty | null {
  const source = accounts.find((account) => account.id === sourceAccountId);
  const destination = accounts.find((account) => account.id === destinationAccountId);

  if (isLoanLeg(source) && isLoanLeg(destination)) {
    return null;
  }

  if (destination?.type === "receivable") {
    return {
      direction: "lend",
      label: "Who borrowed it",
      placeholder: "e.g. Sarah",
      requiresPayee: isPool(destination),
      showExpectedDate: true,
    };
  }

  if (source?.type === "receivable") {
    return {
      direction: "collect",
      label: "Who is repaying you",
      placeholder: "e.g. Sarah",
      requiresPayee: isPool(source),
      showExpectedDate: false,
    };
  }

  if (source !== undefined && isInformalDebt(source)) {
    return {
      direction: "borrow",
      label: "Who lent it to you",
      placeholder: "e.g. Auntie Grace",
      requiresPayee: isPool(source),
      showExpectedDate: true,
    };
  }

  if (destination !== undefined && isInformalDebt(destination)) {
    return {
      direction: "repay",
      label: "Who you are repaying",
      placeholder: "e.g. Auntie Grace",
      requiresPayee: isPool(destination),
      showExpectedDate: false,
    };
  }

  return null;
}
