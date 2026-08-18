import { resolveCounterparty } from "@/lib/domain/counterparties";
import {
  isReservedAccount,
  isReservedAccountName,
  ledgerForAccountType,
} from "@/lib/domain/reserved-accounts";
import type { Account, Counterparty, Transaction } from "@/lib/types";

export type DeleteVerdict = { allowed: true } | { allowed: false; reason: string };

export function countAccountTransactions(
  accountId: string,
  transactions: Transaction[],
): number {
  return transactions.filter((transaction) => transaction.accountId === accountId).length;
}

export function canDeleteAccount(
  account: Account,
  transactions: Transaction[],
): DeleteVerdict {
  if (isReservedAccount(account)) {
    return {
      allowed: false,
      reason: `${account.name} is created for everyone and cannot be deleted. Archive it instead to hide it.`,
    };
  }

  const count = countAccountTransactions(account.id, transactions);
  if (count > 0) {
    return {
      allowed: false,
      reason:
        count === 1
          ? "This account has 1 transaction. Archive it, or merge it, so the record is not lost."
          : `This account has ${count} transactions. Archive it, or merge it, so the records are not lost.`,
    };
  }

  return { allowed: true };
}

export type MergePlan =
  | { blocked: string }
  | {
      blocked?: undefined;
      counterparty: Counterparty;
      transactions: Transaction[];
      target: Account;
    };

export type MergeRequest = {
  source: Account;
  target: Account;
  transactions: Transaction[];
  counterparties: Counterparty[];
  timestamp: string;
  nextCounterpartyId: () => string;
};

export function planAccountMerge(request: MergeRequest): MergePlan {
  const { source, target, transactions, counterparties, timestamp, nextCounterpartyId } =
    request;

  if (source.id === target.id) {
    return { blocked: "An account cannot be merged into itself." };
  }
  if (isReservedAccount(source)) {
    return { blocked: `${source.name} is created for everyone and cannot be merged away.` };
  }
  if (source.type !== target.type) {
    return {
      blocked: `${source.name} and ${target.name} track opposite directions of money, so merging them would flip the sign on every record.`,
    };
  }

  const ledger = ledgerForAccountType(source.type);
  if (!ledger) {
    return { blocked: `${source.name} is not a lending or borrowing account.` };
  }

  const resolved = resolveCounterparty(counterparties, {
    name: source.name,
    kind: ledger.counterpartyKind,
    userId: source.userId,
    id: nextCounterpartyId(),
    timestamp,
  });

  const carried = Math.abs(source.openingBalance);
  const counterparty =
    carried === 0
      ? resolved.counterparty
      : {
          ...resolved.counterparty,
          openingBalance: (resolved.counterparty.openingBalance ?? 0) + carried,
          updatedAt: timestamp,
        };

  const moved = transactions
    .filter((transaction) => transaction.accountId === source.id)
    .map((transaction) => ({
      ...transaction,
      accountId: target.id,
      counterpartyId: counterparty.id,
      payee: counterparty.name,
      updatedAt: timestamp,
    }));

  return {
    counterparty,
    transactions: moved,
    target: {
      ...target,
      openingBalance: target.openingBalance + source.openingBalance,
      balance: target.balance + source.openingBalance,
      updatedAt: timestamp,
    },
  };
}

export function findDuplicatePoolAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      !account.isArchived &&
      !isReservedAccount(account) &&
      isReservedAccountName(account.name),
  );
}
