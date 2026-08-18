import { BORROWING_LEDGER, isInformalDebt } from "@/lib/domain/borrowing";
import { LENDING_LEDGER } from "@/lib/domain/lending";
import { isReservedAccount } from "@/lib/domain/reserved-accounts";
import type { Account, Counterparty, CounterpartyKind } from "@/lib/types";

export type TransferDirection = "lend" | "collect" | "borrow" | "repay";

export type TransferCounterparty = {
  direction: TransferDirection;
  label: string;
  placeholder: string;
  requiresPayee: boolean;
  showExpectedDate: boolean;
};

function isLoanLeg(account: Account | undefined): boolean {
  return account !== undefined && (account.type === "receivable" || isInformalDebt(account));
}

function isPool(account: Account | undefined): boolean {
  return account !== undefined && isReservedAccount(account);
}

export function counterpartyKindForDirection(
  direction: TransferDirection,
): CounterpartyKind {
  return direction === "lend" || direction === "collect"
    ? LENDING_LEDGER.counterpartyKind
    : BORROWING_LEDGER.counterpartyKind;
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

export const NEW_COUNTERPARTY = "counterparty:new";

export function counterpartyOptionsFor(
  counterparties: Counterparty[],
  direction: TransferDirection,
): { value: string; label: string }[] {
  const wanted = counterpartyKindForDirection(direction);

  const people = counterparties
    .filter((entry) => !entry.isArchived)
    .sort((left, right) => {
      const leftMatches = left.kind === wanted || left.kind === "both";
      const rightMatches = right.kind === wanted || right.kind === "both";
      if (leftMatches !== rightMatches) {
        return leftMatches ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .map((entry) => ({ value: entry.id, label: entry.name }));

  return [...people, { value: NEW_COUNTERPARTY, label: "Someone else…" }];
}
